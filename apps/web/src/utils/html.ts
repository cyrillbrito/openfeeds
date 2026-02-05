export function containsHtml(text: string): boolean {
  return /<[^>]+>/.test(text);
}

export function downshiftHeadings(html: string, levels: number = 3): string {
  return html.replace(/<(\/?)h([1-6])([^>]*)>/gi, (_match, closing, level, attrs) => {
    const currentLevel = parseInt(level, 10);
    const newLevel = Math.min(6, currentLevel + levels);
    return `<${closing}h${newLevel}${attrs}>`;
  });
}
