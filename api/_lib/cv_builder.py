from datetime import datetime, timezone
from typing import Any

PROFILE = {
    "name": "Faza Fauzan Adzima",
    "status": "Pelajar, Pengembang Web, dan Pegiat Keamanan Siber",
    "whatsapp": "0882-0002-20587",
    "whatsappUrl": "https://wa.me/62882000220587",
    "githubHandle": "fazafauzanadzima123-dotcom",
    "githubUrl": "https://github.com/fazafauzanadzima123-dotcom",
}


def build_cv_json(portfolio: dict[str, Any]) -> dict[str, Any]:
    """Assemble factual JSON CV structure from live Supabase records."""
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": portfolio.get("source", "supabase"),
        "profile": PROFILE,
        "projects": portfolio.get("projects", []),
        "achievements": portfolio.get("achievements", []),
    }


def build_cv_markdown(portfolio: dict[str, Any]) -> str:
    """Render clean Markdown CV containing only verified user achievements and projects."""
    lines = [
        f"# {PROFILE['name']}",
        "",
        f"Status: {PROFILE['status']}",
        f"GitHub: {PROFILE['githubUrl']}",
        f"WhatsApp: {PROFILE['whatsapp']} ({PROFILE['whatsappUrl']})",
        "",
        "## Proyek Pengembangan Web",
        "",
    ]

    projects = portfolio.get("projects", [])
    if not projects:
        lines.append("- Belum ada data proyek tersimpan.")
    else:
        for proj in projects:
            stack_list = proj.get("stack") or []
            stack_text = f" ({', '.join(stack_list)})" if stack_list else ""
            lines.append(f"- **{proj.get('name', '')}** ({proj.get('domain', '')}): {proj.get('summary', '')}{stack_text}")
            lines.append(f"  Tautan: {proj.get('url', '')}")

    lines.extend(["", "## Prestasi", ""])
    achievements = portfolio.get("achievements", [])
    if not achievements:
        lines.append("- Belum ada data prestasi tersimpan.")
    else:
        for ach in achievements:
            year_val = ach.get("year")
            year_suffix = f" ({year_val})" if year_val else ""
            lines.append(
                f"- **{ach.get('rank_label', '')}**: {ach.get('title', '')}, {ach.get('category', '')}{year_suffix}"
            )

    lines.extend(
        [
            "",
            "---",
            f"Sumber data: {portfolio.get('source', 'supabase')}",
            "",
        ]
    )
    return "\n".join(lines)
