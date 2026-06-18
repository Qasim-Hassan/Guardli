import { Devvit, SettingScope } from '@devvit/public-api';

// 1. Declare the settings natively where Reddit can scan them
Devvit.addSettings([
  {
    type: 'string',
    name: 'google_api_key',
    label: 'Google API Key',
    defaultValue: '',
    isSecret: true,
    scope: SettingScope.App, 
  },
]);

export default Devvit;
