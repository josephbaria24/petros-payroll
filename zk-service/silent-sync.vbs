Set WinScript = CreateObject("WScript.Shell")
' Using absolute path to pythonw.exe to prevent any intermittent console search/flash
WinScript.Run """C:\Program Files\Python314\pythonw.exe"" zk-puller.py", 0, False
