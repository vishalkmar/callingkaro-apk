import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { registerCallService } from './src/services/voice/callForeground';
import { name as appName } from './app.json';

// Ongoing-call service for Telnyx calls (must be registered before any notification uses it).
registerCallService();
AppRegistry.registerComponent(appName, () => App);
