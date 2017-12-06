set -x
cd packages/js-interpreter-portal
yarn install --production=false
cd ../js-interpreter-tyrant
yarn install --production=false
yarn run build
yarn link
cd ../js-interpreter-portal
yarn link @code-dot-org/js-interpreter-tyrant
yarn run build:server
