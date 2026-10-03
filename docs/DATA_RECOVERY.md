# Device-only garden storage

Garden records, photos, points, appearance and focus sessions save automatically. GitHub authentication and manual backup cards have been removed.

On Android, select an internal shared folder under Documents when first opening the app. The app writes two checksummed snapshots in its MindGarden subfolder, retaining the previous snapshot if a write fails. App updates retain the folder permission and automatically load existing app data. After uninstall/reinstall, choose the same shared folder once to grant access again; restoration runs before garden initialization. Complete silent restoration after uninstall is not supported by Android's folder permission model. Do not delete the MindGarden folder.

If folder selection is postponed, only app-private data is saved and uninstall removes that data. Reopen the app to select a folder before uninstalling. Invalid snapshots are never overwritten when no readable generation remains. Failed shared writes retain app-private state and retry. Web browser builds keep browser localStorage only.

Install updates over the existing app before selecting the folder. If Android rejects an update because the signing certificate differs, preserve the existing installation and its data rather than uninstalling it.

For migration from a differently signed old APK, export mind-garden-backup.json with the old app before uninstalling and retain it in the selected Documents folder (or its MindGarden subfolder). The new app accepts this legacy export on first startup when its own two snapshots do not yet exist. Never uninstall the old app before exporting and checking the backup file.
