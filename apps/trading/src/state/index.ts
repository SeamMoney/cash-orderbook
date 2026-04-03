import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query/react'
import localForage from 'localforage'
import { type PersistConfig, persistReducer, persistStore } from 'redux-persist'
import createSagaMiddleware from 'redux-saga'
import { delegationListenerMiddleware } from 'uniswap/src/features/smartWallet/delegation/slice'
import { isDevEnv, isTestEnv } from 'utilities/src/environment/env'

import { updateVersion } from '~/state/global/actions'
import { customCreateMigrate, INDEXED_DB_REDUX_TABLE_NAME, migrations, PERSIST_VERSION } from '~/state/migrations'
import { routingApi } from '~/state/routing/slice'
import { rootWebSaga, sagaTriggerActions } from '~/state/sagas/root'
import { walletCapabilitiesListenerMiddleware } from '~/state/walletCapabilities/reducer'
import { type InterfaceState, interfacePersistedStateList, interfaceReducer } from '~/state/webReducer'

const persistConfig: PersistConfig<InterfaceState> = {
  key: 'interface',
  version: PERSIST_VERSION,
  storage: localForage.createInstance({
    name: INDEXED_DB_REDUX_TABLE_NAME,
    driver: localForage.LOCALSTORAGE,
  }),
  migrate: customCreateMigrate(migrations, { debug: false }),
  whitelist: interfacePersistedStateList,
  throttle: 1000, // ms
  serialize: false,
  // The typescript definitions are wrong - we need this to be false for unserialized storage to work.
  // We need unserialized storage for inspectable db entries for debugging.
  // @ts-ignore
  deserialize: false,
  debug: isDevEnv(),
}

const persistedReducer = persistReducer(persistConfig, interfaceReducer)

const sagaMiddleware = createSagaMiddleware()

export function createDefaultStore() {
  const store = configureStore({
    reducer: persistedReducer,
    enhancers: (defaultEnhancers) => defaultEnhancers,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: true,
        immutableCheck: isTestEnv()
          ? false
          : {
              ignoredPaths: [routingApi.reducerPath, 'logs', 'lists'],
            },
        serializableCheck: isTestEnv()
          ? false
          : {
              warnAfter: 128,
              // meta.arg and meta.baseQueryMeta are defaults. payload.trade is a nonserializable return value, but that's ok
              // because we are not adding it into any persisted store that requires serialization (e.g. localStorage)
              ignoredActionPaths: ['meta.arg', 'meta.baseQueryMeta', 'payload.trade'],
              ignoredPaths: [routingApi.reducerPath],
              ignoredActions: [
                // ignore saga trigger actions
                ...sagaTriggerActions,
                // ignore the redux-persist actions
                'persist/PERSIST',
                'persist/REHYDRATE',
                'persist/PURGE',
                'persist/FLUSH',
              ],
            },
      })
        .concat(sagaMiddleware)
        .concat(walletCapabilitiesListenerMiddleware.middleware)
        .concat(delegationListenerMiddleware.middleware),
  })
  sagaMiddleware.run(rootWebSaga)

  return store
}

const store = createDefaultStore()
export const persistor = persistStore(store)

setupListeners(store.dispatch)

store.dispatch(updateVersion())

export default store
