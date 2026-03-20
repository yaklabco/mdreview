import type {
  Theme,
  ThemeName,
  AppState,
  ConversionResult,
  Comment,
  CommentParseResult,
  ExportFormat,
  PaperSize,
  ContentNode,
  CachedResult,
  WorkerTask,
} from '../types/index';

describe('@mdview/core types', () => {
  it('should allow creating a Theme object', () => {
    const theme: Theme = {
      name: 'github-light',
      displayName: 'GitHub Light',
      variant: 'light',
      author: 'test',
      version: '1.0.0',
      colors: {
        background: '#fff',
        backgroundSecondary: '#f6f8fa',
        backgroundTertiary: '#eee',
        foreground: '#24292e',
        foregroundSecondary: '#586069',
        foregroundMuted: '#6a737d',
        primary: '#0366d6',
        secondary: '#6f42c1',
        accent: '#e36209',
        heading: '#24292e',
        link: '#0366d6',
        linkHover: '#0366d6',
        linkVisited: '#6f42c1',
        codeBackground: '#f6f8fa',
        codeText: '#24292e',
        codeKeyword: '#d73a49',
        codeString: '#032f62',
        codeComment: '#6a737d',
        codeFunction: '#6f42c1',
        border: '#e1e4e8',
        borderLight: '#eaecef',
        borderHeavy: '#d1d5da',
        selection: '#0366d633',
        highlight: '#fff3cd',
        shadow: 'rgba(27,31,35,0.15)',
        success: '#28a745',
        warning: '#ffd33d',
        error: '#d73a49',
        info: '#0366d6',
        commentHighlight: '#fff3cd',
        commentHighlightResolved: '#dcffe4',
        commentCardBg: '#ffffff',
      },
      typography: {
        fontFamily: 'system-ui',
        codeFontFamily: 'monospace',
        baseFontSize: '16px',
        baseLineHeight: 1.6,
        h1Size: '2em',
        h2Size: '1.5em',
        h3Size: '1.25em',
        h4Size: '1em',
        h5Size: '0.875em',
        h6Size: '0.85em',
        fontWeightNormal: 400,
        fontWeightBold: 600,
        headingFontWeight: 600,
      },
      spacing: {
        blockMargin: '16px',
        paragraphMargin: '16px',
        listItemMargin: '4px',
        headingMargin: '24px',
        codeBlockPadding: '16px',
        tableCellPadding: '6px 13px',
      },
      syntaxTheme: 'github',
      mermaidTheme: {
        theme: 'default',
        themeVariables: {
          primaryColor: '#0366d6',
          primaryTextColor: '#24292e',
          primaryBorderColor: '#e1e4e8',
          lineColor: '#586069',
          secondaryColor: '#6f42c1',
          tertiaryColor: '#e36209',
          background: '#fff',
          mainBkg: '#fff',
        },
      },
    };
    expect(theme.name).toBe('github-light');
    expect(theme.variant).toBe('light');
  });

  it('should allow ThemeName literals', () => {
    const names: ThemeName[] = [
      'github-light',
      'github-dark',
      'catppuccin-latte',
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
      'monokai',
      'monokai-pro',
    ];
    expect(names).toHaveLength(8);
  });

  it('should allow ExportFormat and PaperSize types', () => {
    const format: ExportFormat = 'docx';
    const size: PaperSize = 'A4';
    expect(format).toBe('docx');
    expect(size).toBe('A4');
  });

  it('should allow Comment type with all fields', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'test',
      body: 'a comment',
      author: 'tester',
      date: new Date().toISOString(),
      resolved: false,
      context: {
        line: 1,
        section: 'Introduction',
        sectionLevel: 1,
        breadcrumb: ['Introduction'],
      },
      tags: ['nit', 'suggestion'],
      replies: [{ id: 'reply-1', author: 'reviewer', body: 'agreed', date: new Date().toISOString() }],
      reactions: { '👍': ['tester'] },
    };
    expect(comment.id).toBe('comment-1');
  });
});
