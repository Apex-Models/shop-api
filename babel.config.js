module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '18',
        },
        modules: 'commonjs',
      },
    ],
    [
      '@babel/preset-typescript',
      {
        allowDeclareFields: true,
      },
    ],
  ],
  ignore: [
    'node_modules',
    'dist',
    '**/*.test.ts',
    '**/*.test.js',
    'prisma/migrations',
  ],
}; 