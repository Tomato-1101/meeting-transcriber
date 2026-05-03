from google import genai
from openai import AsyncOpenAI

from app.config import GOOGLE_API_KEY, OPENAI_API_KEY
from app.utils.logger import logger

PROMPTS = {
    "lecture_notes": """あなたは大学の授業ノートを作る学生アシスタントです。
以下は授業の音声を文字起こしした生テキストです。「この資料だけ読めば授業を受けたのと同等の理解が得られる」ノートに整理してください。

メリハリの方針 (重要):
- **知識点と、その知識点についての詳しい解説は省略せずに残す。** 定義・原理・なぜそうなるか・条件・例外・注意点はしっかり書く。
- **例・例題・余談・雑談・言い直し・脱線は短く要約。** 「先生は◯◯の例で説明した」程度の1〜2行に圧縮し、口頭での再現はしない。
- 何を言ったかではなく「何が分かれば良いか」を中心に書く。先生の口調や言い回しを再現する必要はない。
- 数式・定義・固有名詞・人名・年号・専門用語は原文ママを優先（解説本文は読みやすく整える）。
- 文字起こしに無い知識を勝手に補わない。推測で内容を足さない。
- 不明瞭箇所は「(聞き取り不明)」と簡潔に示す。
- 元の文字起こしが日本語以外の場合も、日本語でノートを作成する。

文字起こし誤認識の補正 (重要):
- 文字起こしには音声認識ミスが含まれることが多い。前後の文脈と一般知識から「明らかに」音声認識ミスだと分かる固有名詞・専門用語・人名・地名・年号などは、推測される正しい語に置き換えて自然に書く。
  - 例: 「ダーウィンが書いた『種の起源』『人類の由来』で、人はオニャララのオニャララから進化したと述べた」
    → 文脈（ダーウィン・人類進化）と一般知識から「オラウータン」ではなく類人猿（おそらく「類人猿」「サル」あたり）と判断し、自然な表現に置き換える。
- 置き換えは「文脈 + 一般知識で確信度が高い場合のみ」。少しでも怪しい場合は原文ママを残し「(聞き取り不明)」を付ける。
- 置き換えた場合は、ノート最後の `## 文字起こし補正メモ` セクションに「元: ◯◯ → 補正: △△」の形で必ず1行ずつ列挙する（読み手が誤補正に気付けるように）。
- 補正がゼロなら `## 文字起こし補正メモ` セクション自体を省略してよい。

出力フォーマット (Markdown):
# 授業ノート: <推定タイトル（科目名やテーマから推測）>

## 概要
（科目・テーマ・全体の流れを 3-5 行で）

## 1. <トピック1>
### 知識点
- 定義・公式・事実・条件などを箇条書きで漏らさず列挙

### 詳しい解説
（その知識点が「なぜそうなるか」「どういう仕組みか」「どこが重要か」「どんな前提条件があるか」を、
段落で詳しく書く。先生の言い回しを再現するのではなく、教科書のように整理して説明する。
複数の知識点がある場合はサブ見出し ### や箇条書きで分けてよい）

### 例・補足（任意・短く）
（先生が出した例や脱線は1-3行で要約のみ。例題の解法を全部書かない。
「◯◯の例で説明された」「△△と関連付けて補足された」のような形で十分）

## 2. <トピック2>
... 同様に章立て ...

## 連絡事項
- 提出物、期限、次回範囲、変更点、休講情報など（あれば）

## 復習チェックリスト
- [ ] このトピックの重要ポイント1
- [ ] このトピックの重要ポイント2
- [ ] ...

## 文字起こし補正メモ
（文字起こしの認識ミスを文脈と一般知識から推測補正した場合のみ、このセクションを出す。何も補正していなければ丸ごと省略する）
- 元: 「オニャララのオニャララ」 → 補正: 「類人猿」 (理由: ダーウィン『人類の由来』の文脈)
""",

    "lecture_qa": """あなたは大学の授業の音声文字起こしから、試験勉強用の詳細な Q&A ノートを作る学生アシスタントです。
要約ではなく、先生が解説した内容を Q→A の形に再構成し、A は段落で詳しく書いてください。

絶対ルール:
- 1 トピックにつき 3-6 個の Q を出す。
- A は最低 3 文以上、先生の口頭解説を再現する形で詳しく書く。
- 数式・定義・固有名詞は原文ママ。
- 文字起こしに含まれない知識を勝手に補わない。
- 不明瞭箇所は「(聞き取り不明)」と明示。
- 連絡事項は最後にまとめる。
- 元の文字起こしが日本語以外の場合も、日本語で出力する。

文字起こし誤認識の補正:
- 前後の文脈と一般知識から「明らかに」音声認識ミスだと分かる固有名詞・人名・専門用語などは、推測される正しい語に自然に置き換える。
- 置き換えは確信度が高い場合のみ。怪しければ原文ママを残し「(聞き取り不明)」を付ける。
- 置き換えた場合は、最後の `## 文字起こし補正メモ` セクションに「元: ◯◯ → 補正: △△」を1行ずつ列挙する。補正ゼロなら省略してよい。

出力フォーマット (Markdown):
# 授業 Q&A: <推定タイトル>

## 概要
（科目・テーマ・全体の流れを 2-3 行）

## トピック1: <トピック名>
**Q1.** <問い>
A: <段落で詳しい回答>

**Q2.** <問い>
A: <段落で詳しい回答>

...

## トピック2: <トピック名>
... 同様 ...

## 連絡事項
- 提出物、期限、次回範囲など

## 文字起こし補正メモ
（補正した場合のみ。何もなければ省略）
- 元: 「◯◯」 → 補正: 「△△」 (理由: ...)
""",

    "summary": """以下の会議の文字起こしを、要点を押さえた簡潔な要約にまとめてください。
箇条書きで、重要なポイントを分かりやすく整理してください。""",

    "detailed_summary": """以下の会議の文字起こしを、詳細なサマリーにまとめてください。
議論の流れ、各トピックの要点、参加者の主な発言をカバーしてください。""",

    "explanation": """以下の会議の文字起こしについて、詳しい解説をしてください。
会議の背景、議論されたトピック、各トピックの詳細を分かりやすく説明してください。""",

    "key_points": """以下の会議の文字起こしから、要点を整理してください。
番号付きリストで、最も重要なポイントから順に並べてください。""",

    "decisions": """以下の会議の文字起こしから、決定事項を抽出してください。
各決定事項について、何が決まったか、その理由や背景も可能な範囲で記載してください。""",

    "action_items": """以下の会議の文字起こしから、タスクやアクションアイテムを抽出してください。
各アイテムについて、担当者（分かる場合）、期限（言及されている場合）、内容を記載してください。""",

    "unresolved": """以下の会議の文字起こしから、未解決の事項や保留事項を整理してください。
各事項について、何が未解決か、今後どうする予定か（分かる場合）を記載してください。""",

    "reformat": """以下の会議の文字起こしを、他のAIに渡しやすい構造化された形式に整形してください。
セクション分け、話者ごとの発言整理、トピック分類などを行ってください。
Markdown形式で出力してください。""",
}


PROMPT_META: dict[str, dict[str, str]] = {
    "lecture_notes": {
        "label": "授業ノート（章立て）",
        "description": "授業内容を章立てで整理。知識点・先生の解説・例題・連絡事項を全て残す詳細ノート。",
        "category": "lecture",
    },
    "lecture_qa": {
        "label": "授業Q&A",
        "description": "授業内容を試験対策用の Q→A 形式に再構成。各回答は先生の解説を段落で詳しく再現。",
        "category": "lecture",
    },
    "summary": {
        "label": "要約",
        "description": "要点を押さえた簡潔な箇条書き要約。",
        "category": "general",
    },
    "detailed_summary": {
        "label": "詳細サマリー",
        "description": "議論の流れと各トピックの要点を含む詳細サマリー。",
        "category": "meeting",
    },
    "explanation": {
        "label": "解説",
        "description": "会議の背景や議論内容を解説形式で説明。",
        "category": "meeting",
    },
    "key_points": {
        "label": "要点整理",
        "description": "重要ポイントを優先度順に番号付きリストで整理。",
        "category": "general",
    },
    "decisions": {
        "label": "決定事項",
        "description": "決まったこと、その理由・背景を抽出。",
        "category": "meeting",
    },
    "action_items": {
        "label": "アクションアイテム",
        "description": "タスク・担当者・期限を抽出。",
        "category": "meeting",
    },
    "unresolved": {
        "label": "未解決事項",
        "description": "未解決事項と今後の対応予定を整理。",
        "category": "meeting",
    },
    "reformat": {
        "label": "AI向け整形",
        "description": "他のAIに渡しやすいよう Markdown で構造化整形。",
        "category": "general",
    },
}


CHAT_SYSTEM_PROMPT = """あなたは授業ノート / AI出力に対する補助講師です。
以下のコンテキスト（元の文字起こしと、それを元に作成された資料）を踏まえて、ユーザーの質問に答えてください。

絶対ルール:
- コンテキスト外の情報は推測せず「資料には記載がありません」と明言する。
- 必要に応じて該当箇所を引用する。
- 簡潔に答え、不要な前置きは省く。
- 数式・定義・固有名詞は原文ママ。
"""


async def run_ai_processing(
    full_text: str,
    result_type: str,
    model: str = "gemini-2.5-flash",
    custom_prompt: str | None = None,
) -> str:
    prompt_template = custom_prompt or PROMPTS.get(result_type, PROMPTS["summary"])
    full_prompt = f"{prompt_template}\n\n---\n\n{full_text}"

    logger.info(f"Running AI processing: type={result_type}, model={model}")

    if model.startswith("gemini"):
        return await _call_gemini(full_prompt, model)
    elif model.startswith("gpt"):
        return await _call_openai(full_prompt, model)
    else:
        raise ValueError(f"Unsupported model: {model}")


async def run_chat(
    transcription_text: str,
    ai_result_text: str,
    ai_result_type: str,
    history: list[dict],
    user_message: str,
    model: str = "gemini-2.5-flash",
) -> str:
    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in history[-10:]
    )

    context_block = f"""[元の文字起こし]
{transcription_text}

[これまでに生成されたAI出力 (種類: {ai_result_type})]
{ai_result_text}
"""

    full_prompt = (
        f"{CHAT_SYSTEM_PROMPT}\n\n---\n\n{context_block}\n---\n\n"
        f"[これまでの会話]\n{history_text or '(なし)'}\n\n"
        f"USER: {user_message}\nASSISTANT:"
    )

    logger.info(f"Running chat: model={model}, history_len={len(history)}")

    if model.startswith("gemini"):
        return await _call_gemini(full_prompt, model)
    elif model.startswith("gpt"):
        return await _call_openai(full_prompt, model)
    else:
        raise ValueError(f"Unsupported model: {model}")


async def _call_gemini(prompt: str, model: str) -> str:
    client = genai.Client(api_key=GOOGLE_API_KEY)
    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
    )
    return response.text


async def _call_openai(prompt: str, model: str) -> str:
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content
