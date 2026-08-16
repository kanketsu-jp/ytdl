```bash
python3 pipeline.py --help
python3 pipeline.py fetch --url https://youtu.be/1PSKbIsvs6g --outdir /tmp/ytdl-test
python3 pipeline.py transcribe --outdir /tmp/ytdl-test --name <name> --pass 1
python3 pipeline.py diarize --outdir /tmp/ytdl-test --name <name>
python3 pipeline.py transcribe --outdir /tmp/ytdl-test --name <name> --pass 2 --prompt-file nouns.txt
python3 pipeline.py align --outdir /tmp/ytdl-test --name <name>
python3 pipeline.py scenes --outdir /tmp/ytdl-test --name <name>
python3 pipeline.py emit --outdir /tmp/ytdl-test --name <name>
python3 pipeline.py run --url https://youtu.be/1PSKbIsvs6g --outdir /tmp/ytdl-test
```
