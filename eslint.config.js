// Flat config. The per-folder `no-restricted-imports` blocks are the machine
// version of docs/ARCHITECTURE.md §2: layers point down only.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/** Bottom to top, see ARCHITECTURE §2. */
const LAYERS = ['core', 'world', 'grammar', 'geometry', 'render', 'sim', 'editor'];

/** Patterns matching a layer by alias (`@/render/x`) or relative path (`../render/x`). */
function layerPatterns(layer, allowed = []) {
  return [
    // No bare `@/layer` entry: gitignore semantics would exclude the directory
    // and make the `!` exceptions below impossible.
    `@/${layer}/**`,
    `**/${layer}/**`,
    ...allowed.flatMap((a) => [`!@/${layer}/${a}`, `!**/${layer}/${a}`]),
  ];
}

/** Everything above `layer` is off limits to it. */
function upwardBan(layer, exceptions = {}) {
  const above = LAYERS.slice(LAYERS.indexOf(layer) + 1);
  return above.map((up) => ({
    group: layerPatterns(up, exceptions[up] ?? []),
    message: `${layer}/ must not import from ${up}/ (layers point down only, ARCHITECTURE §2).`,
  }));
}

/** Pure layers never see three at all. */
const NO_THREE = {
  group: ['three', 'three/*'],
  message: 'This layer is pure data and math; three belongs to geometry/ (math only) and render/.',
};

/** geometry/ may use three math and BufferGeometry, not scene objects or materials. */
const GEOMETRY_THREE_PATHS = [
  {
    name: 'three',
    importNames: [
      'Scene',
      'Object3D',
      'Group',
      'Mesh',
      'InstancedMesh',
      'SkinnedMesh',
      'Line',
      'LineSegments',
      'Points',
      'Sprite',
      'Light',
      'DirectionalLight',
      'HemisphereLight',
      'AmbientLight',
      'PointLight',
      'SpotLight',
      'Camera',
      'PerspectiveCamera',
      'OrthographicCamera',
      'WebGLRenderer',
      'Texture',
      'DataTexture',
    ],
    message:
      'geometry/ returns BufferGeometry bundles; Mesh/Scene/lights/textures live in render/.',
  },
];
const GEOMETRY_THREE_PATTERNS = [
  {
    group: ['three'],
    importNamePattern: 'Material$',
    message: 'Materials come from render/materials.ts only.',
  },
];

function restrict(layer, { pureThree = false, exceptions = {} } = {}) {
  return {
    files: [`src/${layer}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: pureThree ? [] : layer === 'geometry' ? GEOMETRY_THREE_PATHS : [],
          patterns: [
            ...upwardBan(layer, exceptions),
            ...(pureThree ? [NO_THREE] : []),
            ...(layer === 'geometry' ? GEOMETRY_THREE_PATTERNS : []),
          ],
        },
      ],
    },
  };
}

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.playwright-mcp/**', 'scripts/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-exports': [
        'error',
        { restrictDefaultExports: { direct: true, named: true, defaultFrom: true } },
      ],
    },
  },
  // design-constants.ts has zero imports and is the one geometry/ module the
  // pure layers may read (CLAUDE.md puts it there; grammar params need the numbers).
  restrict('core', { pureThree: true }),
  restrict('world', { pureThree: true, exceptions: { geometry: ['design-constants'] } }),
  restrict('grammar', { pureThree: true, exceptions: { geometry: ['design-constants'] } }),
  restrict('geometry'),
  restrict('render'),
  restrict('sim', { pureThree: true, exceptions: { geometry: ['design-constants'] } }),
  restrict('editor'),
  {
    files: ['**/*.config.{js,ts}', 'vite.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
  prettier,
);
