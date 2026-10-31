import { useNetInfo } from '@react-native-community/netinfo';

/** True unless the device positively reports no connection (unknown counts as online). */
export function useOnline(): boolean {
  const net = useNetInfo();
  return net.isConnected !== false && net.isInternetReachable !== false;
}
