// Generates the plan templates in this folder. Run: node templates/build.mjs
// Each template is validated by packages/shared/test/templates.test.ts.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const LC = (tag) => `https://leetcode.com/tag/${tag}/`;
const NEET = 'https://neetcode.io/roadmap';

function write(slug, plan) {
  writeFileSync(join(here, `${slug}.sparksquad.json`), `${JSON.stringify(plan, null, 2)}\n`);
}

function rest(day, title = 'Rest and review the week') {
  return { day, title, rest: true, tasks: [] };
}

/* ---------------- DSA 30 ---------------- */
{
  // [day title, leetcode tag, problems, difficulty, study title, study link, notes focus]
  const topics = [
    [
      'Arrays: the basics',
      'array',
      2,
      'easy',
      'Learn array traversal and prefix sums',
      NEET,
      'array patterns',
    ],
    [
      'Arrays: prefix sums',
      'prefix-sum',
      2,
      'easy',
      'Watch a prefix sum walkthrough',
      'https://www.geeksforgeeks.org/prefix-sum-array-implementation-applications-competitive-programming/',
      'prefix sums',
    ],
    [
      'Arrays: in-place tricks',
      'array',
      2,
      'medium',
      'Study in-place swaps and Kadane’s algorithm',
      'https://cp-algorithms.com/others/maximum_average_segment.html',
      'Kadane’s algorithm',
    ],
    [
      'Strings: the basics',
      'string',
      2,
      'easy',
      'Learn string building and character counts',
      NEET,
      'string tricks',
    ],
    [
      'Strings: palindromes and anagrams',
      'string',
      2,
      'medium',
      'Study palindrome and anagram checks',
      NEET,
      'palindrome patterns',
    ],
    [
      'Hashing: maps and sets',
      'hash-table',
      2,
      'easy',
      'Learn when to reach for a hash map',
      NEET,
      'hash map use cases',
    ],
    null,
    [
      'Hashing: counting and grouping',
      'hash-table',
      2,
      'medium',
      'Study group-by-key problems',
      NEET,
      'grouping with keys',
    ],
    [
      'Two pointers: opposite ends',
      'two-pointers',
      2,
      'easy',
      'Watch the two-pointer lesson',
      NEET,
      'two-pointer setups',
    ],
    [
      'Two pointers: same direction',
      'two-pointers',
      2,
      'medium',
      'Study fast and slow pointers',
      NEET,
      'pointer movement rules',
    ],
    [
      'Sliding window: fixed size',
      'sliding-window',
      2,
      'easy',
      'Learn the fixed-size window template',
      NEET,
      'window templates',
    ],
    [
      'Sliding window: variable size',
      'sliding-window',
      2,
      'medium',
      'Study the shrink-when-invalid window',
      NEET,
      'when to shrink a window',
    ],
    [
      'Stack: the basics',
      'stack',
      2,
      'easy',
      'Learn stack operations and bracket matching',
      NEET,
      'stack use cases',
    ],
    null,
    [
      'Stack: monotonic stack',
      'monotonic-stack',
      2,
      'medium',
      'Study the monotonic stack pattern',
      NEET,
      'next greater element',
    ],
    [
      'Binary search: the template',
      'binary-search',
      2,
      'easy',
      'Learn a bug-free binary search template',
      'https://cp-algorithms.com/num_methods/binary_search.html',
      'search boundaries',
    ],
    [
      'Binary search on the answer',
      'binary-search',
      2,
      'medium',
      'Study binary search on the answer space',
      'https://cp-algorithms.com/num_methods/binary_search.html',
      'answer-space search',
    ],
    [
      'Linked list: the basics',
      'linked-list',
      2,
      'easy',
      'Learn reversal and dummy nodes',
      NEET,
      'pointer rewiring',
    ],
    [
      'Linked list: fast and slow',
      'linked-list',
      2,
      'medium',
      'Study cycle detection and middle node',
      NEET,
      'Floyd’s cycle detection',
    ],
    [
      'Trees: traversals',
      'tree',
      2,
      'easy',
      'Learn pre, in and post-order traversals',
      NEET,
      'traversal orders',
    ],
    null,
    [
      'Trees: depth and paths',
      'depth-first-search',
      2,
      'easy',
      'Study recursive depth and path sums',
      NEET,
      'recursion on trees',
    ],
    [
      'Trees: level order',
      'breadth-first-search',
      2,
      'medium',
      'Learn BFS with a queue',
      NEET,
      'level-order tricks',
    ],
    [
      'Binary search trees',
      'binary-search-tree',
      2,
      'medium',
      'Study BST properties and validation',
      NEET,
      'BST invariants',
    ],
    [
      'Graphs: representation and DFS',
      'graph',
      2,
      'easy',
      'Learn adjacency lists and DFS',
      'https://cp-algorithms.com/graph/depth-first-search.html',
      'graph building',
    ],
    [
      'Graphs: BFS and grids',
      'breadth-first-search',
      2,
      'medium',
      'Study BFS on grids',
      'https://cp-algorithms.com/graph/breadth-first-search.html',
      'grid traversal',
    ],
    [
      'Graphs: connected components',
      'union-find',
      2,
      'medium',
      'Learn union-find basics',
      'https://cp-algorithms.com/data_structures/disjoint_set_union.html',
      'union-find',
    ],
    null,
    [
      'Graphs: topological sort',
      'topological-sort',
      2,
      'medium',
      'Study topological sorting',
      'https://cp-algorithms.com/graph/topological-sort.html',
      'dependency ordering',
    ],
    [
      'Final mixed practice',
      'array',
      3,
      'medium',
      'Take a timed 45-minute mock round',
      NEET,
      'what to revise next',
    ],
  ];
  const days = topics.map((t, i) => {
    const day = i + 1;
    if (!t) return rest(day);
    const [title, tag, n, diff, study, link, notes] = t;
    return {
      day,
      title,
      tasks: [
        {
          title: `Solve ${n} ${diff} ${tag.replace(/-/g, ' ')} problems`,
          type: 'count',
          target: n,
          unit: 'problems',
          verify: 'leetcode',
          link: LC(tag),
        },
        { title: study, type: 'minutes', target: 30, link },
        { title: `Write notes on ${notes}`, type: 'check' },
      ],
    };
  });
  write('dsa-30', {
    sparksquad_plan: 1,
    title: '30 days of DSA',
    goal: 'Build a solid base for coding interviews in a month',
    category: 'career',
    duration_days: 30,
    days_per_week: 6,
    phases: [
      { name: 'Arrays, strings, hashing', from_day: 1, to_day: 8 },
      { name: 'Pointers, windows, stacks', from_day: 9, to_day: 15 },
      { name: 'Search, lists, trees', from_day: 16, to_day: 24 },
      { name: 'Graphs', from_day: 25, to_day: 30 },
    ],
    days,
    milestones: [
      { day: 8, title: 'Arrays and hashing done' },
      { day: 15, title: 'Pointer patterns done' },
      { day: 24, title: 'Trees done' },
      { day: 30, title: '30 days of DSA complete' },
    ],
  });
}

/* ---------------- DSA 60 ---------------- */
{
  const phases = [
    {
      name: 'Arrays, strings, hashing',
      from: 1,
      to: 14,
      topics: [
        ['Arrays: traversal', 'array', 'easy'],
        ['Arrays: prefix sums', 'prefix-sum', 'easy'],
        ['Arrays: Kadane and subarrays', 'array', 'medium'],
        ['Strings: building and counting', 'string', 'easy'],
        ['Strings: palindromes', 'string', 'medium'],
        ['Hashing: frequency maps', 'hash-table', 'easy'],
        ['Hashing: grouping by key', 'hash-table', 'medium'],
        ['Matrix traversal', 'matrix', 'medium'],
        ['Sorting and custom comparators', 'sorting', 'medium'],
        ['Intervals: merge and insert', 'array', 'medium'],
        ['Hashing: prefix sum + map', 'hash-table', 'medium'],
        ['Phase 1 mixed practice', 'array', 'medium'],
      ],
    },
    {
      name: 'Pointers, windows, stacks, search',
      from: 15,
      to: 28,
      topics: [
        ['Two pointers: opposite ends', 'two-pointers', 'easy'],
        ['Two pointers: 3Sum family', 'two-pointers', 'medium'],
        ['Sliding window: fixed size', 'sliding-window', 'easy'],
        ['Sliding window: variable size', 'sliding-window', 'medium'],
        ['Stack: brackets and parsing', 'stack', 'easy'],
        ['Monotonic stack', 'monotonic-stack', 'medium'],
        ['Queue and deque', 'queue', 'medium'],
        ['Binary search: classic', 'binary-search', 'easy'],
        ['Binary search: rotated arrays', 'binary-search', 'medium'],
        ['Binary search on the answer', 'binary-search', 'medium'],
        ['Heaps: top K', 'heap-priority-queue', 'medium'],
        ['Phase 2 mixed practice', 'two-pointers', 'medium'],
      ],
    },
    {
      name: 'Lists, trees, graphs',
      from: 29,
      to: 45,
      topics: [
        ['Linked list: reversal', 'linked-list', 'easy'],
        ['Linked list: fast and slow', 'linked-list', 'medium'],
        ['Trees: traversals', 'tree', 'easy'],
        ['Trees: depth and paths', 'depth-first-search', 'medium'],
        ['Trees: level order', 'breadth-first-search', 'medium'],
        ['Binary search trees', 'binary-search-tree', 'medium'],
        ['Tries', 'trie', 'medium'],
        ['Backtracking: subsets', 'backtracking', 'medium'],
        ['Backtracking: permutations', 'backtracking', 'medium'],
        ['Graphs: DFS and islands', 'depth-first-search', 'medium'],
        ['Graphs: BFS shortest path', 'breadth-first-search', 'medium'],
        ['Graphs: union-find', 'union-find', 'medium'],
        ['Graphs: topological sort', 'topological-sort', 'medium'],
        ['Graphs: Dijkstra', 'shortest-path', 'medium'],
        ['Phase 3 mixed practice', 'graph', 'medium'],
      ],
    },
    {
      name: 'Dynamic programming',
      from: 46,
      to: 60,
      topics: [
        ['DP: 1D basics', 'dynamic-programming', 'easy'],
        ['DP: house robber family', 'dynamic-programming', 'medium'],
        ['DP: coin change', 'dynamic-programming', 'medium'],
        ['DP: longest increasing subsequence', 'dynamic-programming', 'medium'],
        ['DP: grids', 'dynamic-programming', 'medium'],
        ['DP: two strings (LCS, edit distance)', 'dynamic-programming', 'medium'],
        ['DP: knapsack', 'dynamic-programming', 'medium'],
        ['Greedy', 'greedy', 'medium'],
        ['Bit manipulation', 'bit-manipulation', 'easy'],
        ['DP on trees', 'dynamic-programming', 'medium'],
        ['Mock interview: 2 problems in 60 minutes', 'dynamic-programming', 'medium'],
        ['Final mock round', 'array', 'medium'],
        ['Final review and next steps', 'graph', 'medium'],
      ],
    },
  ];
  const days = [];
  for (const p of phases) {
    let i = 0;
    for (let day = p.from; day <= p.to; day++) {
      if (day % 7 === 0) {
        days.push(rest(day));
        continue;
      }
      const t = p.topics[i++ % p.topics.length];
      const [title, tag, diff] = t;
      const n = diff === 'easy' ? 3 : 2;
      days.push({
        day,
        title,
        tasks: [
          {
            title: `Solve ${n} ${diff} ${tag.replace(/-/g, ' ')} problems`,
            type: 'count',
            target: n,
            unit: 'problems',
            verify: 'leetcode',
            link: LC(tag),
          },
          { title: `Study ${title.toLowerCase()}`, type: 'minutes', target: 30, link: NEET },
          { title: 'Re-solve one older problem without notes', type: 'check' },
          { title: 'Write notes on today’s pattern', type: 'check' },
        ],
      });
    }
  }
  write('dsa-60', {
    sparksquad_plan: 1,
    title: '60 days of DSA',
    goal: 'Clear product-company coding rounds',
    category: 'career',
    duration_days: 60,
    days_per_week: 6,
    phases: phases.map((p) => ({ name: p.name, from_day: p.from, to_day: p.to })),
    days,
    milestones: [
      { day: 14, title: 'Arrays and hashing phase complete' },
      { day: 28, title: 'Pointers and search phase complete' },
      { day: 45, title: 'Trees and graphs phase complete' },
      { day: 60, title: '60 days of DSA complete' },
    ],
  });
}

/* ---------------- Aptitude 21 ---------------- */
{
  const QUANT = 'https://www.indiabix.com/aptitude/questions-and-answers/';
  const LOGIC = 'https://www.indiabix.com/verbal-reasoning/questions-and-answers/';
  const VERBAL = 'https://www.indiabix.com/verbal-ability/questions-and-answers/';
  const topics = [
    ['Number system', QUANT, 15],
    ['Percentages', QUANT, 15],
    ['Profit and loss', QUANT, 15],
    ['Ratio and proportion', QUANT, 15],
    ['Averages and ages', QUANT, 15],
    ['Time and work', QUANT, 15],
    null,
    ['Time, speed and distance', QUANT, 15],
    ['Simple and compound interest', QUANT, 15],
    ['Permutations and probability', QUANT, 15],
    ['Number and letter series', LOGIC, 20],
    ['Coding and decoding', LOGIC, 20],
    ['Blood relations and directions', LOGIC, 20],
    null,
    ['Seating arrangement', LOGIC, 15],
    ['Syllogisms', LOGIC, 20],
    ['Reading comprehension', VERBAL, 10],
    ['Sentence correction', VERBAL, 20],
    ['Para jumbles and vocabulary', VERBAL, 20],
    ['Full mock test', QUANT, 30],
    null,
  ];
  const days = topics.map((t, i) => {
    const day = i + 1;
    if (!t) return rest(day, 'Review mistakes from this week');
    const [title, link, n] = t;
    const mock = title === 'Full mock test';
    return {
      day,
      title,
      tasks: [
        mock
          ? { title: 'Take a 60-minute timed mock test', type: 'minutes', target: 60, link }
          : {
              title: `Practise ${n} ${title.toLowerCase()} questions`,
              type: 'count',
              target: n,
              unit: 'questions',
              link,
            },
        {
          title: mock ? 'Note your three weakest topics' : 'Write down the shortcuts you used',
          type: 'check',
        },
      ],
    };
  });
  write('aptitude-21', {
    sparksquad_plan: 1,
    title: '21 days of aptitude',
    goal: 'Clear quant, logical and verbal rounds in placement tests',
    category: 'career',
    duration_days: 21,
    days_per_week: 6,
    phases: [
      { name: 'Quantitative aptitude', from_day: 1, to_day: 10 },
      { name: 'Logical reasoning', from_day: 11, to_day: 16 },
      { name: 'Verbal ability and mock', from_day: 17, to_day: 21 },
    ],
    days,
    milestones: [
      { day: 10, title: 'Quant topics covered' },
      { day: 16, title: 'Reasoning topics covered' },
      { day: 20, title: 'First full mock done' },
    ],
  });
}

/* ---------------- SQL 30 ---------------- */
{
  const BOLT = (l) => `https://sqlbolt.com/lesson/${l}`;
  const SQL50 = 'https://leetcode.com/studyplan/top-sql-50/';
  const lessons = [
    ['SELECT basics', BOLT('select_queries_introduction'), 0],
    ['Filtering with WHERE', BOLT('select_queries_with_constraints'), 1],
    ['Sorting and LIMIT', BOLT('filtering_sorting_query_results'), 1],
    ['Review of SELECT', BOLT('select_queries_review'), 2],
    ['INNER JOIN', BOLT('multi_table_queries_with_joins'), 2],
    ['OUTER JOINs', BOLT('select_queries_with_outer_joins'), 2],
    null,
    ['Working with NULL', BOLT('select_queries_with_nulls'), 2],
    ['Expressions', BOLT('select_queries_with_expressions'), 2],
    ['Aggregates', BOLT('select_queries_with_aggregates'), 2],
    ['GROUP BY and HAVING', BOLT('select_queries_with_aggregates_pt_2'), 2],
    ['Order of execution', BOLT('select_queries_order_of_execution'), 2],
    ['INSERT, UPDATE, DELETE', BOLT('inserting_rows'), 1],
    null,
    ['Creating and altering tables', BOLT('creating_tables'), 1],
    ['Subqueries', 'https://mode.com/sql-tutorial/sql-sub-queries', 2],
    ['CASE expressions', 'https://mode.com/sql-tutorial/sql-case', 2],
    [
      'String and date functions',
      'https://mode.com/sql-tutorial/sql-string-functions-for-cleaning',
      2,
    ],
    ['Self joins', 'https://mode.com/sql-tutorial/sql-self-joins', 2],
    ['UNION and set operations', 'https://mode.com/sql-tutorial/sql-union', 2],
    null,
    ['Window functions: ranking', 'https://mode.com/sql-tutorial/sql-window-functions', 2],
    [
      'Window functions: running totals',
      'https://www.postgresql.org/docs/current/tutorial-window.html',
      2,
    ],
    ['Common table expressions', 'https://www.postgresql.org/docs/current/queries-with.html', 2],
    ['Indexes and query plans', 'https://use-the-index-luke.com/sql/anatomy', 1],
    ['Normalisation', 'https://www.guru99.com/database-normalization.html', 0],
    ['Interview mix: joins and aggregates', SQL50, 3],
    null,
    ['Interview mix: windows and CTEs', SQL50, 3],
    ['Final review', SQL50, 3],
  ];
  const days = lessons.map((t, i) => {
    const day = i + 1;
    if (!t) return rest(day, 'Rest and revisit tricky queries');
    const [title, link, n] = t;
    const tasks = [
      {
        title: `Study ${title.replace(/^[A-Z][a-z]/, (s) => s.toLowerCase())}`,
        type: 'minutes',
        target: 25,
        link,
      },
    ];
    if (n > 0) {
      tasks.push({
        title: `Solve ${n} SQL problems`,
        type: 'count',
        target: n,
        unit: 'problems',
        verify: 'leetcode',
        link: SQL50,
      });
    }
    return { day, title, tasks };
  });
  write('sql-30', {
    sparksquad_plan: 1,
    title: '30 days of SQL',
    goal: 'Write interview-ready SQL with joins, aggregates and window functions',
    category: 'career',
    duration_days: 30,
    days_per_week: 6,
    phases: [
      { name: 'Querying basics', from_day: 1, to_day: 13 },
      { name: 'Intermediate SQL', from_day: 14, to_day: 21 },
      { name: 'Advanced and interviews', from_day: 22, to_day: 30 },
    ],
    days,
    milestones: [
      { day: 12, title: 'Aggregates mastered' },
      { day: 24, title: 'Window functions and CTEs done' },
      { day: 30, title: '30 days of SQL complete' },
    ],
  });
}

/* ---------------- Steps 10k ---------------- */
{
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    if (day % 7 === 0) {
      return {
        day,
        title: 'Easy day',
        tasks: [
          {
            title: 'Walk 6,000 steps at an easy pace',
            type: 'count',
            target: 6000,
            unit: 'steps',
            verify: 'steps',
          },
        ],
      };
    }
    const target = day <= 7 ? 7000 : day <= 14 ? 8000 : day <= 21 ? 9000 : 10000;
    return {
      day,
      title: target === 10000 ? '10K day' : `Build up: ${target.toLocaleString('en-US')} steps`,
      tasks: [
        {
          title: `Walk ${target.toLocaleString('en-US')} steps`,
          type: 'count',
          target,
          unit: 'steps',
          verify: 'steps',
        },
      ],
    };
  });
  write('steps-10k', {
    sparksquad_plan: 1,
    title: '10K steps',
    goal: 'Walk 10,000 steps a day by the end of the month',
    category: 'fitness',
    duration_days: 30,
    days_per_week: 7,
    phases: [
      { name: 'Build up', from_day: 1, to_day: 21 },
      { name: 'Hold 10K', from_day: 22, to_day: 30 },
    ],
    days,
    milestones: [
      { day: 7, title: 'First week done' },
      { day: 22, title: 'First 10K day' },
      { day: 30, title: '30 days of walking complete' },
    ],
  });
}

/* ---------------- System design 30 ---------------- */
{
  const PRIMER = 'https://github.com/donnemartin/system-design-primer';
  const P = (anchor) => `${PRIMER}#${anchor}`;
  const topics = [
    [
      'How to approach a design round',
      P('how-to-approach-a-system-design-interview-question'),
      null,
    ],
    ['Performance vs scalability', P('performance-vs-scalability'), null],
    ['Latency vs throughput', P('latency-vs-throughput'), null],
    ['CAP theorem', P('cap-theorem'), null],
    ['Consistency patterns', P('consistency-patterns'), null],
    ['Availability patterns', P('availability-patterns'), 'a status page'],
    null,
    ['DNS', P('domain-name-system'), null],
    ['CDNs', P('content-delivery-network'), 'image hosting with a CDN'],
    ['Load balancers', P('load-balancer'), null],
    ['Reverse proxies', P('reverse-proxy-web-server'), null],
    ['Application layer and microservices', P('application-layer'), null],
    [
      'Relational databases and replication',
      P('relational-database-management-system-rdbms'),
      null,
    ],
    null,
    ['Sharding and federation', P('sharding'), null],
    ['NoSQL stores', P('nosql'), 'a key-value store'],
    ['Caching strategies', P('cache'), null],
    ['Message queues', P('asynchronism'), 'an email sending pipeline'],
    ['Communication: HTTP, TCP, RPC, REST', P('communication'), null],
    ['Security basics', P('security'), null],
    null,
    ['Design a URL shortener', P('design-pastebincom-or-bitly'), 'a URL shortener'],
    ['Design a rate limiter', 'https://stripe.com/blog/rate-limiters', 'a rate limiter'],
    [
      'Design a news feed',
      P('design-the-twitter-timeline-and-search-or-facebook-feed-and-search'),
      'a news feed',
    ],
    [
      'Design a chat app',
      'https://bytebytego.com/courses/system-design-interview/design-a-chat-system',
      'a chat app',
    ],
    ['Design a web crawler', P('design-a-web-crawler'), 'a web crawler'],
    [
      'Design a key-value store',
      P('design-a-key-value-cache-to-save-the-results-of-the-most-recent-web-server-queries'),
      'a distributed cache',
    ],
    null,
    [
      'Mock design round',
      P('system-design-interview-questions-with-solutions'),
      'a ride-hailing app',
    ],
    ['Final review', PRIMER, 'your favourite system end to end'],
  ];
  const days = topics.map((t, i) => {
    const day = i + 1;
    if (!t) return rest(day, 'Rest and redraw one design from memory');
    const [title, link, sketch] = t;
    const tasks = [
      { title: `Read: ${title.toLowerCase()}`.slice(0, 80), type: 'minutes', target: 40, link },
    ];
    if (sketch) tasks.push({ title: `Sketch the design of ${sketch}`.slice(0, 80), type: 'check' });
    return { day, title, tasks };
  });
  write('system-design-30', {
    sparksquad_plan: 1,
    title: '30 days of system design',
    goal: 'Explain and draw common system designs in an interview',
    category: 'career',
    duration_days: 30,
    days_per_week: 6,
    phases: [
      { name: 'Foundations', from_day: 1, to_day: 7 },
      { name: 'Building blocks', from_day: 8, to_day: 21 },
      { name: 'Classic designs', from_day: 22, to_day: 30 },
    ],
    days,
    milestones: [
      { day: 7, title: 'Foundations done' },
      { day: 21, title: 'Building blocks done' },
      { day: 30, title: '30 days of system design complete' },
    ],
  });
}

console.log('Templates written.');
