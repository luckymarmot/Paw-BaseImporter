import { UnitTest, registerTest } from '../../utils/TestUtils'

import {
	Mock,
	PawContextMock,
	PawRequestMock
} from '../PawMocks'

@registerTest
export class TestPawMocks extends UnitTest {

    testSimpleMock() {
        let mock = new Mock()

        this.assertEqual(
            Object.keys(mock),
            [ '$$_spy', '$$_spyOn', '$$_getSpy' ]
        )
        this.assertEqual(mock.$$_spy, {})
    }

    testSimpleObjectMock() {
        let mock = new Mock({
            a: 12
        })

        this.assertEqual(
            Object.keys(mock),
            [ '$$_spy', 'a', '$$_spyOn', '$$_getSpy' ]
        )
        this.assertEqual(mock.$$_spy, {})
    }

    testSimpleObjectWithFuncMock() {
        let obj = {
            a: (arg) => {
                return arg * arg
            }
        }

        let mock = new Mock(obj)

        this.assertEqual(
            Object.keys(mock),
            [ '$$_spy', 'a', '$$_spyOn', '$$_getSpy' ]
        )
        this.assertEqual(Object.keys(mock.$$_spy), [ 'a' ])
    }

    testSimpleObjectWithFuncAndVarsMock() {
        let obj = {
            a: (arg) => {
                return arg * arg
            },
            b: true
        }

        let mock = new Mock(obj)

        this.assertEqual(
            Object.keys(mock),
            [ '$$_spy', 'a', 'b', '$$_spyOn', '$$_getSpy' ]
        )
        this.assertEqual(Object.keys(mock.$$_spy), [ 'a' ])
    }

    testSpyOn() {
        let obj = {
            a: (arg) => {
                return arg * arg
            }
        }

        let mock = new Mock(obj)

        mock.$$_spyOn(
            'a',
            (arg) => {
                return arg * 2
            }
        )

        this.assertEqual(
            Object.keys(mock),
            [ '$$_spy', 'a', '$$_spyOn', '$$_getSpy' ]
        )

        let expected = 6
        mock.a(10)
        let result = mock.a(3)
        this.assertEqual(mock.$$_spy.a.count, 2)
        this.assertEqual(mock.$$_spy.a.calls, [ [ 10 ], [ 3 ] ])
        this.assertEqual(result, expected)
    }

    testGetSpy() {
        let obj = {
            a: (arg) => {
                return arg * arg
            }
        }

        let mock = new Mock(obj)

        mock.$$_spyOn(
            'a',
            (arg) => {
                return arg * 2
            }
        )

        this.assertEqual(
            Object.keys(mock),
            [ '$$_spy', 'a', '$$_spyOn', '$$_getSpy' ]
        )

        mock.a(10)
        mock.a(3)

        this.assertEqual(mock.$$_getSpy('a').count, 2)
        this.assertEqual(mock.$$_getSpy('a').calls, [ [ 10 ], [ 3 ] ])
    }

    testMultipleSpies() {
        let obj = {
            a: (arg) => {
                return arg * arg
            },
            b: (key, value) => {
                let result = {}
                result[value] = key
                return result
            }
        }

        let mock = new Mock(obj)

        mock
            .$$_spyOn(
                'a',
                (arg) => {
                    return arg * 2
                }
            )
            .$$_spyOn(
                'b',
                (k, v) => {
                    return k + ',' + v
                }
            )

        mock.a(10)
        mock.b(3, 10)

        this.assertEqual(mock.$$_getSpy('a').count, 1)
        this.assertEqual(mock.$$_getSpy('a').calls, [ [ 10 ] ])

        this.assertEqual(mock.$$_getSpy('b').count, 1)
        this.assertEqual(mock.$$_getSpy('b').calls, [ [ 3, 10 ] ])
    }

    testPrefix() {
        let obj = {
            a: (arg) => {
                return arg * arg
            },
            b: true
        }

        let mock = new Mock(obj, '__')

        this.assertEqual(
            Object.keys(mock),
            [ '__spy', 'a', 'b', '__spyOn', '__getSpy' ]
        )
        this.assertEqual(Object.keys(mock.__spy), [ 'a' ])

        // no prefix
        mock = new Mock(obj, '')

        this.assertEqual(
            Object.keys(mock),
            [ 'spy', 'a', 'b', 'spyOn', 'getSpy' ]
        )
        this.assertEqual(Object.keys(mock.spy), [ 'a' ])
    }

    testEmptyPawContextMock() {
        const pawContextFields = [
            'getCurrentRequest',
            'getRequestByName',
            'getRequestGroupByName',
            'getRootRequestTreeItems',
            'getRootRequests',
            'getAllRequests',
            'getAllGroups',
            'getEnvironmentDomainByName',
            'getEnvironmentVariableByName',
            'getRequestById',
            'getRequestGroupById',
            'getEnvironmentDomainById',
            'getEnvironmentVariableById',
            'getEnvironmentById',
            'createRequest',
            'createRequestGroup',
            'createEnvironmentDomain'
        ]

        const mock = new PawContextMock(null, '')

        this.assertEqual(
            Object.keys(mock),
            [ 'spy', ...pawContextFields, 'spyOn', 'getSpy' ]
        )

        this.assertEqual(Object.keys(mock.spy), pawContextFields)
    }

    testEmptyPawRequestMock() {
        const pawRequestFields = [
            'id',
            'name',
            'order',
            'parent',
            'url',
            'method',
            'headers',
            'httpBasicAuth',
            'oauth1',
            'oauth2',
            'body',
            'urlEncodedBody',
            'multipartBody',
            'jsonBody',
            'timeout',
            'followRedirects',
            'redirectAuthorization',
            'redirectMethod',
            'sendCookies',
            'storeCookies'
        ]

        const pawRequestFuncFields = [
            'getUrl',
            'getHeaders',
            'getHeaderByName',
            'setHeader',
            'getHttpBasicAuth',
            'getOAuth1',
            'getOAuth2',
            'getBody',
            'getUrlEncodedBody',
            'getMultipartBody',
            'getLastExchange'
        ]

        const mock = new PawRequestMock(null, '')

        this.assertEqual(
            Object.keys(mock),
            [
                'spy',
                ...pawRequestFields,
                ...pawRequestFuncFields,
                'spyOn',
                'getSpy'
            ]
        )

        this.assertEqual(Object.keys(mock.spy), pawRequestFuncFields)
    }
}
