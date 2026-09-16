// PRIMEIRA linha de propósito: o monitoramento de erros liga antes de o resto
// do app carregar, para registrar também as falhas de boot.
import './src/lib/monitoring/init';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
