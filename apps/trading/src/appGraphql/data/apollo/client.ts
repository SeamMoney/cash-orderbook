import { ApolloClient, from, HttpLink } from '@apollo/client'
import { setupSharedApolloCache } from 'uniswap/src/data/cache'
import { getDatadogApolloLink } from 'utilities/src/logger/datadog/datadogLink'
import { getRetryLink } from '~/appGraphql/data/apollo/retryLink'

const API_URL = process.env.REACT_APP_AWS_API_ENDPOINT
if (!API_URL) {
  throw new Error('AWS API ENDPOINT MISSING FROM ENVIRONMENT')
}

// In development, use the Vite proxy to avoid CORS issues with the Uniswap GraphQL API.
// The proxy at /graphql forwards to https://beta.gateway.uniswap.org/v1/graphql.
const graphqlUri = import.meta.env.DEV ? '/graphql' : API_URL

const httpLink = new HttpLink({ uri: graphqlUri })
const datadogLink = getDatadogApolloLink()
const retryLink = getRetryLink()

export const apolloClient = new ApolloClient({
  connectToDevTools: true,
  link: from([retryLink, httpLink]),
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://app.uniswap.org',
  },
  cache: setupSharedApolloCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
    },
  },
})
