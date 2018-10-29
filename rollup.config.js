import babel from 'rollup-plugin-babel'
import pkg from './package.json'
import resolve from 'rollup-plugin-node-resolve';

const makeExternalPredicate = externalArr => {
  if (externalArr.length === 0) {
    return () => false
  }
  const pattern = new RegExp(`^(${externalArr.join('|')})($|/)`)
  return id => pattern.test(id)
}

export default {
  input: 'src/index.js',

  output: [
    { file: pkg.main, format: 'cjs' },
    { file: pkg.module, format: 'es' },
  ],

  external: makeExternalPredicate([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]),

  plugins: [
    babel({ plugins: ['external-helpers'] }),
    resolve({
      extensions: [ '.mjs', '.js', '.jsx', '.json' ],  // Default: [ '.mjs', '.js', '.json', '.node' ],
      only: [
        /^state-transducer$/,
      ], // Default: null
    })
  ],
}
