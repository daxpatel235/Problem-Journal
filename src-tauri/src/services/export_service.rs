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
        ## Problem Statement\n\n{problem_statement}\n\n\
        ## Examples\n\n{examples}\n\n\
        ## Brute Force\n\n{brute_force}\n\n\
        ## Pattern\n\n{pattern}\n\n\
        ## Thinking\n\n{thinking}\n\n\
        ## Complexity\n\n\
        - **Brute Force Time:** {bf_time}\n\
        - **Brute Force Space:** {bf_space}\n\
        - **Optimal Time:** {time}\n\
        - **Optimal Space:** {space}\n\n\
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
        problem_statement = if problem.problem_statement.is_empty() { "_Not provided._".to_string() } else { problem.problem_statement.clone() },
        examples = numbered_list(&problem.examples),
        brute_force = numbered_list(&problem.brute_force),
        bf_time = if problem.brute_force_time_complexity.is_empty() {
            "—".to_string()
        } else {
            problem.brute_force_time_complexity.clone()
        },
        bf_space = if problem.brute_force_space_complexity.is_empty() {
            "—".to_string()
        } else {
            problem.brute_force_space_complexity.clone()
        },
        pattern = numbered_list(&problem.pattern),
        thinking = numbered_list(&problem.thinking),
        time = if problem.time_complexity.is_empty() {
            "—".to_string()
        } else {
            problem.time_complexity.clone()
        },
        space = if problem.space_complexity.is_empty() {
            "—".to_string()
        } else {
            problem.space_complexity.clone()
        },
        mistakes = numbered_list(&problem.mistakes),
        takeaways = numbered_list(&problem.takeaways),
        language = problem.language,
        code = problem.code,
    )
}

pub fn export_json(problems: &[Problem]) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(problems)
}
