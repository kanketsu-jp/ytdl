---
name: transcribe-scenes
description: 動画から「誰が・いつ・何を話し、そのとき画面に何が映っていたか」まで揃った文字起こしを作る。Whisper の2段階文字起こし、声色による話者分離、同音異義語の置換、指示語のシーンを ffmpeg で画像化、最後に構造化 JSON と字幕へまとめる。「動画を文字起こしして」「話者ごとに分けて」「誰が話しているか知りたい」「字幕を作って」「イベントの記録を残したい」「対談を文字に起こして」と言われたときに使う。
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# transcribe-scenes

動画 1 本から、次をまとめて作ります。

```
<outdir>/<動画名>/
  transcript.json    構造化データ（最終成果物）
  transcript.md      読み物
  subtitles.srt      字幕
  subtitles.vtt      字幕
  speakers.json      話者ごとの発話量
  images/            「ここ」「これ」と言っている場面の静止画
  logs/              工程ごとの生データ（やり直し・検証用）
```

実体は `scripts/pipeline.py`。**あなた（Claude）は工程の間で判断を入れる役**で、
機械にできることは pipeline.py に任せます。

## いちばん大事なこと

🚨 **固有名詞を Whisper のプロンプトに入れるだけでは、精度は上がりません。**

2026-08-16 に同じ動画で実測した結果:

| | 出力 |
|---|---|
| プロンプト無し | 大阪**一新のカイド三好香織**です／新しい**カタノ**へ |
| 固有名詞プロンプト有り | 大阪**維新の会の三好薫**です／新しい**刀**へ ← 直った所と**新しく壊れた所**が両方出る |
| ＋ 置換規則（`normalize`） | 大阪維新の会の三好薫です／新しい**交野**へ ✅ |

**プロンプトは「聞き取りのヒント」、置換規則は「出てきた誤りの直し」。両方要ります。**
置換規則は**1回目の出力を読んでから**作ってください。起きていない誤りを先回りで足さないこと
（誤爆します。例: 「府政」←「不正」は、実際に出たときだけ有効にする）。

## 手順

### 0. 前提

```bash
python3 scripts/pipeline.py --help     # サブコマンドが出れば動く
```

足りない pip パッケージがあれば、日本語で何を入れればよいか表示して止まります。
`scripts/requirements.txt` を見てください。

### 1. 素材と背景を集める（あなたの仕事）

動画を落とす前に、**その動画に出てくるはずの固有名詞**を集めます。

- 依頼者に聞く／サイトを見る／**イベントのチラシや告知**を読む
- チラシは特に効きます。**登壇者の氏名・肩書・団体名・会場名・日付**がそのまま出てくるからです
- 集めたものを 1 行のテキストにして保存（例 `nouns.txt`）

```
みよしかおる、交野市、大阪維新の会、吉村洋文、藤田文武、中司宏、枚方市、寝屋川市、府議、天の川磐船線、…
```

🚨 **Whisper の `initial_prompt` は 224 トークン程度で切られます。**
欲張らず、**間違えられたら困るものだけ**入れてください。切られた場合は pipeline.py が警告します。

### 2. 落として、1回目を回す

```bash
python3 scripts/pipeline.py fetch --url <URL> --outdir <DIR>
python3 scripts/pipeline.py transcribe --outdir <DIR> --name <NAME> --pass 1 --prompt-file nouns.txt
```

ローカルの動画なら `fetch --file <PATH>`。

### 3. 話者を分ける

```bash
python3 scripts/pipeline.py diarize --outdir <DIR> --name <NAME>
```

声色（d-vector）の近さでまとめ、`人物A` `人物B` … を付けます。人数が分かっているなら `--speakers 4`。

🚨 **`logs/03_diarization.json` を必ず読んでください。**
`n_speakers: 1` のとき、それが「本当に1人」なのか「発話区間が少なくて測っていない」のかは
`measured` と `reason` に書いてあります。**1 と書いてあることを、1人である根拠にしないこと。**

### 4. 1回目を読んで、プロンプトと置換規則を作る（あなたの仕事）

`logs/02_whisper_pass1.json` を実際に読み、

- **固有名詞が何に化けたか**を拾って、`rules.json` を作る（形式は `references/rules-example.json`）
- 出てきた人数・話の流れを見て、`nouns.txt` を足す

```json
{ "rules": [ { "right": "交野", "wrong": ["刀", "片野", "カタノ"], "note": "実際に出た誤りだけ" } ] }
```

### 5. 2回目 → 置換 → 突き合わせ

```bash
python3 scripts/pipeline.py transcribe --outdir <DIR> --name <NAME> --pass 2 --prompt-file nouns.txt
python3 scripts/pipeline.py normalize  --outdir <DIR> --name <NAME> --rules rules.json
python3 scripts/pipeline.py align      --outdir <DIR> --name <NAME>
```

`logs/08_normalize.json` に**どの規則が何件効いたか**が出ます。0 件の規則は、
誤りが起きなかったのか、規則が間違っているのかを確かめてください。

### 6. 話者に実名を当てる（あなたの仕事）

pipeline.py は **絶対に実名を推測しません**（`speaker_label` は必ず `null`）。
`logs/06_aligned.json` を読み、**本文の内容から**割り当てます。

- 自己紹介（「共同代表の藤田文武です」）
- 司会が名前を呼ぶ（「では中司幹事長から」）
- 話題の担当（候補者本人しか言えない内容）

割り当てたら `transcript.json` の `speakers[].label` と `segments[].speaker_label` を書き込みます。

🚨 **確信が持てないものは `null` のまま残す。** 埋めた方が見た目は良くなりますが、
**間違った名前が付いた記録は、無い記録より害があります。**

### 7. 「ここ」「これ」の場面を画像にする

```bash
python3 scripts/pipeline.py scenes --outdir <DIR> --name <NAME>
```

指示語を含むセグメントの時刻で静止画を書き出します。**書き出した画像を実際に見て**、
`transcript.json` の本文に「何を指していたか」を補ってください
（例: 「ここが交野市駅前です」→ 画像に写っているものを本文の注記に足す）。

🚨 「この」「その」は**画面を指していない使い方**も多く拾います（過検出）。
拾いすぎる側に倒してあるので、**見て要らないものは捨ててください**。

🚨 **`initial_prompt` を渡すと、Whisper のセグメントが長い塊になります。**
実測（57秒の動画）: プロンプト無し 14 セグメント → 有り 4 セグメント。
その結果**シーン抽出が 3 件 → 1 件に減りました**（1 つの長い塊に指示語が複数入り、1 件に統合されるため）。
細かい時刻が要るとき（字幕・シーン抽出）は、**プロンプト無しの 1 回目の時刻を使う**ことを検討してください。

### 8. まとめる

```bash
python3 scripts/pipeline.py emit --outdir <DIR> --name <NAME>
```

### 通しで回す

一度やり方が固まったら:

```bash
python3 scripts/pipeline.py run --url <URL> --outdir <DIR> \
  --prompt-file nouns.txt --rules rules.json --speakers 4
```

## 報告するときの決まり

- 「何件」を言うときは、**何を数えたか**を添える（segments / 話者 / 置換件数）
- **「0 件」は、それが「無かった 0」か「見ていない 0」かを書く**
  （`logs/07_scenes.json` の `reason` と `checked_segments`、
  　`logs/03_diarization.json` の `measured` を使えば区別できます）
- 直せなかった箇所は `［聞き取り不明瞭・要確認］` のまま残し、依頼者に確認する

## やってはいけないこと

- 話者の実名を、内容の裏付け無しに当てる
- 置換規則を「起きそうだから」で足す（実際に出た誤りだけ）
- `logs/` を消す（やり直しと検証ができなくなる）
- 音声・動画を外部の API に送る（このパイプラインは全部ローカルで完結します）
