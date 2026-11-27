// Minimal RFC 9309 robots.txt evaluation: groups by user-agent, longest match
// wins, Allow beats Disallow on equal length, `*` and `$` patterns supported.

export type RobotsRules = { groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; pattern: string }>; crawlDelay: number | null }> };

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsRules["groups"] = [];
  let current: RobotsRules["groups"][number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const index = line.indexOf(":");
    if (index < 0) continue;
    const field = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      if (field === "disallow" && value === "") continue;
      current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) current.crawlDelay = delay;
    }
  }
  return { groups };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function groupFor(rules: RobotsRules, userAgent: string) {
  const token = userAgent.toLowerCase().split("/")[0].trim();
  const specific = rules.groups.filter(group => group.agents.some(agent => agent !== "*" && token.includes(agent)));
  if (specific.length) return { rules: specific.flatMap(group => group.rules), crawlDelay: specific.find(group => group.crawlDelay != null)?.crawlDelay ?? null };
  const wildcard = rules.groups.filter(group => group.agents.includes("*"));
  return { rules: wildcard.flatMap(group => group.rules), crawlDelay: wildcard.find(group => group.crawlDelay != null)?.crawlDelay ?? null };
}

export function isAllowed(rules: RobotsRules, userAgent: string, pathAndQuery: string): boolean {
  const { rules: list } = groupFor(rules, userAgent);
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of list) {
    if (!patternToRegex(rule.pattern).test(pathAndQuery)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) best = { allow: rule.allow, length };
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(rules: RobotsRules, userAgent: string): number | null {
  return groupFor(rules, userAgent).crawlDelay;
}
