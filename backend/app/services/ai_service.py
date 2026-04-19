from google import genai
from openai import AsyncOpenAI

from app.config import GOOGLE_API_KEY, OPENAI_API_KEY
from app.utils.logger import logger

PROMPTS = {
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
