/** Sample sources shown in the laptop editor + a tiny regex highlighter (no dependencies). */

export type Lang = 'csharp' | 'ts' | 'plsql'

export interface SourceFile {
  name: string
  lang: Lang
  badge: string
  color: string
  lines: string[]
}

export const files: SourceFile[] = [
  {
    name: 'OrdersController.cs',
    lang: 'csharp',
    badge: 'C#',
    color: '#a179dc',
    lines: [
      '[ApiController]',
      '[Route("api/[controller]")]',
      'public class OrdersController : ControllerBase',
      '{',
      '    private readonly IOrderService _orders;',
      '',
      '    public OrdersController(IOrderService orders) => _orders = orders;',
      '',
      '    [HttpGet("{id}")]',
      '    public async Task<ActionResult<OrderDto>> Get(int id)',
      '    {',
      '        var order = await _orders.FindAsync(id);',
      '        return order is null ? NotFound() : Ok(order);',
      '    }',
      '}',
    ],
  },
  {
    name: 'orders.component.ts',
    lang: 'ts',
    badge: 'NG',
    color: '#e23237',
    lines: [
      "import { Component, OnInit } from '@angular/core';",
      '',
      '@Component({',
      "  selector: 'app-orders',",
      "  templateUrl: './orders.component.html',",
      '})',
      'export class OrdersComponent implements OnInit {',
      '  orders$ = this.api.getOrders();',
      '',
      '  constructor(private api: OrdersApi) {}',
      '',
      '  ngOnInit(): void {',
      '    this.api.refresh();',
      '  }',
      '}',
    ],
  },
  {
    name: 'pkg_orders.sql',
    lang: 'plsql',
    badge: 'SQL',
    color: '#f29111',
    lines: [
      'CREATE OR REPLACE PACKAGE BODY pkg_orders AS',
      '',
      '  FUNCTION total(p_id IN NUMBER) RETURN NUMBER IS',
      '    v_total NUMBER := 0;',
      '  BEGIN',
      '    SELECT SUM(qty * price) INTO v_total',
      '      FROM order_items',
      '     WHERE order_id = p_id;',
      '    RETURN v_total;',
      '  END total;',
      '',
      'END pkg_orders;',
    ],
  },
]

const KEYWORDS: Record<Lang, Set<string>> = {
  csharp: new Set(['public', 'private', 'readonly', 'class', 'async', 'await', 'return', 'var', 'is', 'null', 'int', 'new', 'using', 'namespace']),
  ts: new Set(['import', 'from', 'export', 'class', 'implements', 'constructor', 'private', 'this', 'void', 'const', 'return']),
  plsql: new Set(['CREATE', 'OR', 'REPLACE', 'PACKAGE', 'BODY', 'AS', 'FUNCTION', 'IN', 'RETURN', 'IS', 'BEGIN', 'END', 'SELECT', 'INTO', 'FROM', 'WHERE', 'SUM']),
}

/** Xcode-dark inspired palette */
export const TOKEN_COLORS = {
  keyword: '#ff7ab2',
  type: '#5dd8ff',
  string: '#ff8170',
  number: '#d9c97c',
  attr: '#67b7a4',
  fn: '#a2e3ff',
  plain: '#e6edf3',
  punct: '#8a9bb0',
}

export type Token = { text: string; color: string }

export function highlight(line: string, lang: Lang): Token[] {
  const out: Token[] = []
  const re = /("[^"]*"?|'[^']*'?)|(\[[A-Za-z]+(?=[\](]))|(@[A-Za-z]+)|(\b\d+\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z0-9_$"'@]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const [text, str, attrBracket, decorator, num, word, space] = m
    let color = TOKEN_COLORS.punct
    if (str) color = TOKEN_COLORS.string
    else if (attrBracket || decorator) color = TOKEN_COLORS.attr
    else if (num) color = TOKEN_COLORS.number
    else if (space) color = TOKEN_COLORS.plain
    else if (word) {
      const next = line[re.lastIndex]
      if (KEYWORDS[lang].has(word)) color = TOKEN_COLORS.keyword
      else if (/^[A-Z]/.test(word) && lang !== 'plsql') color = TOKEN_COLORS.type
      else if (next === '(') color = TOKEN_COLORS.fn
      else color = TOKEN_COLORS.plain
    }
    out.push({ text, color })
  }
  return out
}

/** Technologies that fly into the editor, in docking order. `file` = which explorer entry lights up. */
export const flyingTech = [
  { label: 'C#', color: '#a179dc', file: 0, from: [-46, -18] },
  { label: '.NET', color: '#7c6cf2', file: 0, from: [-52, 38] },
  { label: 'Angular', color: '#e23237', file: 1, from: [52, -22] },
  { label: 'TypeScript', color: '#3178c6', file: 1, from: [56, 30] },
  { label: 'Oracle', color: '#f80000', file: 2, from: [-44, 72] },
  { label: 'PL/SQL', color: '#f29111', file: 2, from: [46, 74] },
  { label: 'Docker', color: '#2496ed', file: 3, from: [-30, -46] },
  { label: 'Azure DevOps', color: '#0078d4', file: 4, from: [30, -48] },
] as const

export const extraFiles = [
  { name: 'Dockerfile', badge: 'DK', color: '#2496ed' },
  { name: 'azure-pipelines.yml', badge: 'YML', color: '#0078d4' },
]
