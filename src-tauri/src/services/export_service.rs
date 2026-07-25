use crate::models::problem::Problem;

fn numbered_list(items: &[String]) -> String {
    if items.is_empty() {
        return "_None recorded._".to_string();
    }
    items
        .iter()
        .enumerate()
        .map(|(i, item)| format!("{}. {}", i + 1, item))
        .collect::<Vec<_>>()
        .join("\n")
}

fn inline_list(items: &[String]) -> String {
    if items.is_empty() {
        return "—".to_string();
    }
    items.join(", ")
}

pub fn export_markdown(problem: &Problem) -> String {
    format!(
        "# {name}\n\n\
        - **Difficulty:** {difficulty}\n\
        - **Topic:** {topic}\n\
        - **Platform:** {platform}\n\
        - **Pattern Category:** {pattern_category}\n\
        - **Tags:** {tags}\n\
        - **URL:** {url}\n\
        - **Favorite:** {favorite}\n\
        - **Created:** {created_at}\n\
        - **Updated:** {updated_at}\n\n\
        ## Pattern\n\n{pattern}\n\n\
        ## Thinking\n\n{thinking}\n\n\
        ## Mistakes\n\n{mistakes}\n\n\
        ## Takeaways\n\n{takeaways}\n\n\
        ## Code ({language})\n\n```{language}\n{code}\n```\n",
        name = problem.problem_name,
        difficulty = problem.difficulty,
        topic = problem.topic,
        platform = problem.platform,
        pattern_category = problem.pattern_category,
        tags = inline_list(&problem.tags),
        url = problem.url,
        favorite = if problem.favorite { "Yes" } else { "No" },
        created_at = problem.created_at,
        updated_at = problem.updated_at,
        pattern = numbered_list(&problem.pattern),
        thinking = numbered_list(&problem.thinking),
        mistakes = numbered_list(&problem.mistakes),
        takeaways = numbered_list(&problem.takeaways),
        language = problem.language,
        code = problem.code,
    )
}

pub fn export_json(problems: &[Problem]) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(problems)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn html_list(items: &[String]) -> String {
    if items.is_empty() {
        return "<p class=\"muted\">None recorded.</p>".to_string();
    }
    let rows: String = items
        .iter()
        .map(|i| format!("<li>{}</li>", html_escape(i)))
        .collect();
    format!("<ol>{rows}</ol>")
}

/// Renders a print-ready HTML document. The frontend opens this in a window
/// and invokes the browser/webview print dialog ("Save as PDF") — avoids
/// bundling a heavyweight PDF layout engine for a single-user desktop tool.
pub fn export_pdf_html(problem: &Problem) -> String {
    format!(
        r#"<!doctype html>
<html><head><meta charset="utf-8"><title>{name}</title>
<style>
body {{ font-family: 'Inter', system-ui, sans-serif; color: #1e1e1e; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }}
h1 {{ font-size: 1.5rem; }}
h2 {{ font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }}
.meta {{ color: #444; font-size: 0.9rem; }}
.muted {{ color: #888; font-style: italic; }}
pre {{ background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }}
</style></head>
<body>
<h1>{name}</h1>
<p class="meta">{difficulty} &middot; {topic} &middot; {platform} &middot; {pattern_category}</p>
<p class="meta">Tags: {tags}</p>
<h2>Pattern</h2>{pattern}
<h2>Thinking</h2>{thinking}
<h2>Mistakes</h2>{mistakes}
<h2>Takeaways</h2>{takeaways}
<h2>Code ({language})</h2>
<pre>{code}</pre>
</body></html>"#,
        name = html_escape(&problem.problem_name),
        difficulty = html_escape(&problem.difficulty),
        topic = html_escape(&problem.topic),
        platform = html_escape(&problem.platform),
        pattern_category = html_escape(&problem.pattern_category),
        tags = html_escape(&inline_list(&problem.tags)),
        pattern = html_list(&problem.pattern),
        thinking = html_list(&problem.thinking),
        mistakes = html_list(&problem.mistakes),
        takeaways = html_list(&problem.takeaways),
        language = html_escape(&problem.language),
        code = html_escape(&problem.code),
    )
}
