import { useNetInfo } from '@react-native-community/netinfo';
import NetInfo from '@react-native-community/netinfo';

/** { isOnline, type } - isOnline is optimistic (true) until NetInfo has an answer. */
export const useNetwork = () => {
  const info = useNetInfo();
  const isOnline = info.isConnected !== false && info.isInternetReachable !== false;
  return { isOnline, type: info.type };
};

/** Non-hook check for services (e.g. before starting a call). */
export const isOnlineNow = async () => {
  const s = await NetInfo.fetch();
  return s.isConnected !== false && s.isInternetReachable !== false;
};

export default useNetwork;
