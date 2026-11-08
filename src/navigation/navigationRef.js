import { createNavigationContainerRef, CommonActions, StackActions } from '@react-navigation/native';

// Lets services (voice events, push notifications) navigate outside React components.
export const navigationRef = createNavigationContainerRef();

const pending = [];

export const flushPendingNavigation = () => {
  while (pending.length && navigationRef.isReady()) {
    pending.shift()();
  }
};

const whenReady = fn => {
  if (navigationRef.isReady()) {
    fn();
  } else {
    pending.push(fn);
  }
};

export const navigate = (name, params) => whenReady(() => navigationRef.navigate(name, params));

export const push = (name, params) => whenReady(() => navigationRef.dispatch(StackActions.push(name, params)));

export const goBack = () =>
  whenReady(() => {
    if (navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  });

export const resetTo = (name, params) =>
  whenReady(() => navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name, params }] })));

export const currentRouteName = () => (navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null);
