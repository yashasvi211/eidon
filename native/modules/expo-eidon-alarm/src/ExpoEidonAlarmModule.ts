import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoEidonAlarmModule extends NativeModule<{}> {}

export default requireNativeModule<ExpoEidonAlarmModule>('ExpoEidonAlarm');
