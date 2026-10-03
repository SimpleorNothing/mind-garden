#!/usr/bin/env python3
"""Copy local garden storage between the two debuggable Android apps over USB."""
import argparse
import io
from pathlib import Path
import shlex
import subprocess
import tarfile

OLD = 'com.simpleornothing.mindgarden.app.v04'
NEW = OLD + '.live'
FOLDERS = ('app_webview/Default/Local Storage', 'app_webview/Local Storage')

def adb(*args, payload=None):
    r = subprocess.run(['adb', *args], input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode:
        raise RuntimeError(r.stderr.decode(errors='replace').strip() or r.stdout.decode(errors='replace').strip())
    return r.stdout

def shell(command):
    return adb('shell', '-T', command)

def run_as(package, command):
    return shell('run-as ' + package + ' sh -c ' + shlex.quote(command))

def folder(package):
    for candidate in FOLDERS:
        try:
            run_as(package, 'test -d ' + shlex.quote(candidate))
            return candidate
        except RuntimeError:
            pass
    return None

def archive(package, directory):
    return adb('exec-out', 'run-as ' + package + ' tar -cf - ' + shlex.quote(directory))

def checked_archive(data, directory):
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        for item in tf:
            if item.name != directory and not item.name.startswith(directory + '/'):
                raise RuntimeError('Unexpected path in backup archive')
            if '..' in Path(item.name).parts or item.issym() or item.islnk():
                raise RuntimeError('Unsafe archive entry')

def main():
    p = argparse.ArgumentParser(description='기존 Mind Garden 데이터를 LIVE 앱으로 복사합니다. 두 앱 모두 유지됩니다. USB 디버깅 및 PC의 adb가 필요합니다.')
    p.add_argument('--apply', action='store_true', help='LIVE 앱 데이터를 백업한 뒤 기존 앱 데이터로 교체')
    p.add_argument('--backup-dir', default='mind-garden-recovery', help='PC 백업 저장 폴더')
    args = p.parse_args()
    devices = adb('devices').decode().splitlines()[1:]
    if sum(line.endswith('\tdevice') for line in devices) != 1:
        raise RuntimeError('휴대폰 1대를 USB로 연결하고 휴대폰에서 USB 디버깅을 허용해 주세요.')
    for package in (OLD, NEW):
        run_as(package, 'pwd')  # Both apps must be installed and debuggable.
    # Close WebViews before copying their LevelDB files; do not uninstall either app.
    for package in (OLD, NEW):
        shell('am force-stop ' + package)
    source = folder(OLD)
    if source is None:
        raise RuntimeError('기존 앱의 저장 폴더를 찾지 못했습니다. 기존 앱을 삭제하지 마세요.')
    backup = Path(args.backup_dir).resolve()
    backup.mkdir(parents=True, exist_ok=True)
    old_data = archive(OLD, source)
    checked_archive(old_data, source)
    old_path = backup / 'original-garden-data.tar'
    if old_path.exists():
        raise RuntimeError('기존 백업 파일이 있습니다. 다른 --backup-dir을 지정해 주세요.')
    old_path.write_bytes(old_data)
    destination = folder(NEW)
    if destination:
        live_data = archive(NEW, destination)
        checked_archive(live_data, destination)
        (backup / 'live-garden-before-transfer.tar').write_bytes(live_data)
    print('기존 정원 데이터를 PC에 백업했습니다:', old_path)
    if not args.apply:
        print('복사하려면 새 백업 폴더를 지정해 --apply로 실행하세요.')
        return
    target = destination or source
    # Normalize Chrome's profile folder when the two apps use different WebView layouts.
    if target != source:
        output = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(old_data)) as original, tarfile.open(fileobj=output, mode='w') as rewritten:
            for item in original:
                content = original.extractfile(item) if item.isfile() else None
                item.name = target + item.name[len(source):]
                rewritten.addfile(item, content)
        old_data = output.getvalue()
    checked_archive(old_data, target)
    try:
        run_as(NEW, 'rm -rf ' + shlex.quote(target))
        adb('shell', '-T', 'run-as ' + NEW + ' tar -xf -', payload=old_data)
    except Exception:
        run_as(NEW, 'rm -rf ' + shlex.quote(target))
        if destination:
            adb('shell', '-T', 'run-as ' + NEW + ' tar -xf -', payload=live_data)
        raise
    shell('am start -n ' + NEW + '/com.simpleornothing.mindgarden.MainActivity')
    print('LIVE 앱에 복사했습니다. 식물·사진·포인트·성장 기록을 확인하세요. 기존 앱은 그대로 유지됩니다.')

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, tarfile.TarError) as e:
        raise SystemExit('이전 중단: ' + str(e))
