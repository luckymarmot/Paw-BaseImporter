import { FileReference, Request, Auth } from 'api-flow'

import { UnitTest, registerTest } from '../../../utils/TestUtils'
import {
    DynamicString,
    DynamicValue,
    PawContextMock,
    PawRequestMock
} from '../../paw-mocks/PawMocks'

import BaseImporter from '../BaseImporter'

@registerTest
export class TestBaseImporter extends UnitTest {
    // TODO
    testResolveFileReferenceReturnsValue() {
        const importer = new BaseImporter()

        const input = 'Some Text'

        let result = importer._resolveFileReference(input)
        this.assertEqual(result, input)
    }

    testResolveFileReferenceReturnsDynamicString() {
        const importer = new BaseImporter()

        const input = new FileReference()

        let result = importer._resolveFileReference(input)
        this.assertTrue(result instanceof DynamicString)
        this.assertTrue(result.components.length === 1)
        this.assertTrue(result.components[0] instanceof DynamicValue)
        this.assertEqual(
            result.components[0].type,
            'com.luckymarmot.FileContentDynamicValue'
        )
    }

    testConvertCharToHex() {
        const importer = new BaseImporter()

        const tests = [
            [ 'a', '61' ],
            [ 'b', '62' ],
            [ 'c', '63' ],
            [ '\b', '08' ]
        ]

        tests.forEach((d) => {
            let result = importer._convertCharToHex(d[0])
            this.assertEqual(result, d[1])
        })
    }

    testEscapeCharSequence() {
        const importer = new BaseImporter()

        const tests = [
            [
                'abc\bhello\nworld',
                '\\x61\\x62\\x63\\x08\\x68\\x65\\x6c\\x6c\\x6f' +
                '\\n\\x77\\x6f\\x72\\x6c\\x64'
            ],
            [
                '\n\r\t',
                '\\n\\r\\t'
            ]
        ]

        tests.forEach((d) => {
            let result = importer._escapeCharSequence(d[0])
            this.assertEqual(result, d[1])
        })
    }

    testEscapeSequenceDynamicValue() {
        const importer = new BaseImporter()

        const input = 'Some Text'
        const expected = '\\x53\\x6f\\x6d\\x65\\x20\\x54\\x65\\x78\\x74'

        let result = importer._escapeSequenceDynamicValue(input)
        this.assertTrue(result instanceof DynamicValue)
        this.assertEqual(
            result.type,
            'com.luckymarmot.EscapeSequenceDynamicValue'
        )
        this.assertEqual(result.escapeSequence, expected)
    }

    testSimpleToDynamicString() {
        const importer = new BaseImporter()
        const input = 'Some\nText'
        const expected = [
            'Some',
            new DynamicValue(
                'com.luckymarmot.EscapeSequenceDynamicValue',
                { escapeSequence: '\\n' }
            ),
            'Text'
        ]

        let result = importer._toDynamicString(input)
        this.assertTrue(result instanceof DynamicString)
        this.assertTrue(result.components.length === 3)
        this.assertEqual(result.components[0], expected[0])
        this.assertEqual(
            result.components[1].escapeSequence,
            expected[1].escapeSequence
        )
        this.assertEqual(result.components[2], expected[2])
    }

    testNoDefaultToDynamicString() {
        const importer = new BaseImporter()
        const expected = null

        let result = importer._toDynamicString(null)
        this.assertEqual(result, expected)
    }

    testDefaultToEmptyToDynamicString() {
        const importer = new BaseImporter()
        const input = new FileReference({
            filepath: 'somepath'
        })
        const expected = importer._resolveFileReference(
            new FileReference({
                filepath: 'somepath'
            })
        )

        let result = importer._toDynamicString(input, true, true)
        this.assertTrue(result instanceof DynamicString)
        this.assertEqual(result.components.length, 1)
        this.assertEqual(
            result.components[0].filepath,
            expected.components[0].filepath
        )
        this.assertEqual(
            result.components[0].type,
            expected.components[0].type
        )
    }

    testResolveFileRefsToDynamicString() {

    }

    testSimpleCreatePawRequest() {
        const importer = new BaseImporter()

        const contextMock = new PawContextMock(null, '')
        const input = new Request({
            url: 'http://fakeurl.com'
        })

        importer._createPawRequest(contextMock, input)

        this.assertTrue(contextMock.spy.createRequest.count === 1)
        this.assertEqual(
            contextMock.spy.createRequest.calls[0].slice(0, 2),
            [ null, null ]
        )
        this.assertEqual(
            contextMock.spy.createRequest.calls[0][2].components[0],
            'http://fakeurl.com'
        )
    }

    testCreatePawRequestWithRequestData() {
        const importer = new BaseImporter()

        const contextMock = new PawContextMock(null, '')
        const input = new Request({
            name: 'testReq',
            method: 'GET',
            url: 'http://fakeurl.com'
        })

        importer._createPawRequest(contextMock, input)

        this.assertTrue(contextMock.spy.createRequest.count === 1)
        this.assertEqual(
            contextMock.spy.createRequest.calls[0].slice(0, 2),
            [ 'testReq', 'GET' ]
        )
        this.assertEqual(
            contextMock.spy.createRequest.calls[0][2].components[0],
            'http://fakeurl.com'
        )
    }

    testSimpleSetHeaders() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const headers = (new Request()).get('headers')

        importer._setHeaders(requestMock, headers)

        this.assertTrue(requestMock.spy.setHeader.count === 0)
    }

    testSetHeadersWithHeaders() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        let req = new Request()
        req = req
            .setIn([ 'headers', 'key' ], 'value')
            .setIn([ 'headers', 'sec' ], 'ond')

        const headers = req.get('headers')

        importer._setHeaders(requestMock, headers)

        this.assertTrue(requestMock.spy.setHeader.count === 2)
        this.assertTrue(requestMock.spy.setHeader.calls[0].length === 2)

        this.__compareSimpleDynamicStrings(
            requestMock.spy.setHeader.calls[0][0],
            new DynamicString('key')
        )
        this.__compareSimpleDynamicStrings(
            requestMock.spy.setHeader.calls[0][1],
            new DynamicString('value')
        )
        this.__compareSimpleDynamicStrings(
            requestMock.spy.setHeader.calls[1][0],
            new DynamicString('sec')
        )
        this.__compareSimpleDynamicStrings(
            requestMock.spy.setHeader.calls[1][1],
            new DynamicString('ond')
        )
    }

    testSetAuthwithBasicAuth() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const auth = new Auth.Basic()

        importer._setAuth(requestMock, auth)

        this.assertTrue(requestMock.spy.setHeader.count === 1)
        this.__compareDynamicValuesInDynamicStrings(
            requestMock.spy.setHeader.calls[0][1],
            new DynamicString(
                new DynamicValue(
                    'com.luckymarmot.BasicAuthDynamicValue',
                    {
                        username: null,
                        password: null
                    }
                )
            ),
            [ 'type', 'username', 'password' ]
        )
    }

    testSetAuthwithInitializedBasicAuth() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const auth = new Auth.Basic({
            username: 'luckymarmot',
            password: 'stub'
        })

        importer._setAuth(requestMock, auth)

        this.assertTrue(requestMock.spy.setHeader.count === 1)
        this.__compareDynamicValuesInDynamicStrings(
            requestMock.spy.setHeader.calls[0][1],
            new DynamicString(
                new DynamicValue(
                    'com.luckymarmot.BasicAuthDynamicValue',
                    {
                        username: 'luckymarmot',
                        password: 'stub'
                    }
                )
            ),
            [ 'type', 'username', 'password' ]
        )
    }

    testSetAuthwithOAuth2() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const auth = new Auth.OAuth2()

        importer._setAuth(requestMock, auth)

        this.assertTrue(requestMock.spy.setHeader.count === 1)
        this.__compareDynamicValuesInDynamicStrings(
            requestMock.spy.setHeader.calls[0][1],
            new DynamicString(
                new DynamicValue(
                    'com.luckymarmot.OAuth2DynamicValue',
                    {
                        grant_clitype: null,
                        authorization_uri: null,
                        access_token_uri: null,
                        scope: ''
                    }
                )
            ),
            [ 'type', 'username', 'password' ]
        )
    }

    testSetAuthwithInitializedOAuth2() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const auth = new Auth.OAuth2({
            flow: 'implicit',
            authorizationUrl: 'auth.luckymarmot.com/oauth2',
            tokenUrl: 'token.luckymarmot.com/oauth2'
        })

        importer._setAuth(requestMock, auth)

        this.assertTrue(requestMock.spy.setHeader.count === 1)
        this.__compareDynamicValuesInDynamicStrings(
            requestMock.spy.setHeader.calls[0][1],
            new DynamicString(
                new DynamicValue(
                    'com.luckymarmot.OAuth2DynamicValue',
                    {
                        grant_clitype: 'implicit',
                        authorization_uri: 'auth.luckymarmot.com/oauth2',
                        access_token_uri: 'token.luckymarmot.com/oauth2',
                        scope: ''
                    }
                )
            ),
            [ 'type', 'username', 'password' ]
        )
    }

    __compareSimpleDynamicStrings(dyn1, dyn2) {
        this.assertEqual(dyn1.components, dyn2.components)
    }

    __compareDynamicValuesInDynamicStrings(dyn1, dyn2, keys) {
        this.assertEqual(dyn1.components.length, dyn2.components.length)
        dyn1.components.forEach((d, i) => {
            for (let key of keys) {
                this.assertEqual(d[key], dyn2.components[i][key])
            }
        })
    }
}
