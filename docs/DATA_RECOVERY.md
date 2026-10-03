# 기존 정원 데이터 이전

Mind Garden 0.4와 Mind Garden LIVE는 서로 다른 Android 앱이다. 기존 앱을 삭제하지 않아도 새 앱이 기존 앱의 저장 공간을 자동으로 읽을 수는 없다. 현재 사용자별 GitHub 서버 백업은 구현되지 않았다.

기존 앱에 내보내기 기능이 없어 USB 디버깅과 PC의 Android Platform Tools(adb)가 필요하다. 두 앱 모두 설치하고 휴대폰을 USB로 연결한 뒤, 휴대폰에 표시되는 USB 디버깅 허용 창을 확인한다.

PC에서 Python 3와 adb를 준비한 뒤 실행한다:

```sh
python tools/transfer_garden.py --apply
```

도구는 기존 앱과 LIVE 앱을 잠시 닫고 두 앱의 데이터를 PC에 백업한 후 LIVE 앱의 로컬 저장소를 기존 정원 데이터로 교체한다. 기존 앱은 삭제하거나 수정하지 않는다. LIVE에 새로 입력한 값이 있다면 이전 전 백업 파일이 남는다. 기본 백업 폴더는 `mind-garden-recovery`다. 파일에는 개인 사진이 들어갈 수 있으므로 공개하지 않는다.

실제 사용자 휴대폰에서는 실행하지 못했으며, 이전 완료 여부는 휴대폰에서 확인해야 한다. debuggable APK가 아닌 앱이나 다른 패키지의 앱에는 적용되지 않는다.

새 LIVE 앱의 ‘정원 데이터 백업’에서 JSON 파일을 저장하고 불러올 수 있다. 앱 업데이트는 동일 패키지와 고정된 LIVE 서명 키를 사용해야 한다. 백업 파일 저장은 수동이며 GitHub 자동 동기화와는 별개다.

LIVE 고정 서명 키는 비공개 `mind-garden-live-signing-private.zip`으로 보관한다. GitHub Actions가 생성한 APK는 배포 전에 이 키로 재서명한다. 키나 비밀번호를 공개 저장소에 올리지 않는다.
