import { registerWebModule, NativeModule } from 'expo';

class ExpoEidonAlarmModule extends NativeModule<{}> {}

export default registerWebModule(ExpoEidonAlarmModule, 'ExpoEidonAlarmModule');
