import Immutable from 'immutable'
import RequestContext, {
    FileReference,
    Request,
    Auth,
    KeyValue,
    SchemaReference
} from 'api-flow'

import { UnitTest, registerTest } from '../../../utils/TestUtils'
import BaseImporterFixtures from './fixtures/BaseImporter-fixtures'
import {
    DynamicString,
    DynamicValue,
    PawContextMock,
    PawRequestMock,
    ClassMock
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
        const auths = new Immutable.List([
            new Auth.Basic()
        ])

        importer._setAuth(requestMock, auths)

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
        const auths = new Immutable.List([
            new Auth.Basic({
                username: 'luckymarmot',
                password: 'stub'
            })
        ])

        importer._setAuth(requestMock, auths)

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
        const auth = new Immutable.List([
            new Auth.OAuth2()
        ])

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
        const auth = new Immutable.List([
                new Auth.OAuth2({
                flow: 'implicit',
                authorizationUrl: 'auth.luckymarmot.com/oauth2',
                tokenUrl: 'token.luckymarmot.com/oauth2'
            })
        ])

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

    testSetFormDataBodyWithSimpleBody() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const body = new Immutable.List([
            new KeyValue({
                key: 'key',
                value: 'value'
            })
        ])

        importer._setFormDataBody(requestMock, body)
        this.__compareDynamicValuesInDynamicStrings(
            requestMock.body,
            new DynamicString(
                new DynamicValue(
                    'com.luckymarmot.BodyMultipartFormDataDynamicValue',
                    { keyValues: null }
                )
            ),
            [ 'type' ]
        )

        const kv = requestMock.body.components[0].keyValues
        const ekv = [
            [ new DynamicString('key'), new DynamicString('value'), true ]
        ]

        this.assertEqual(kv.length, ekv.length)
        this.__compareSimpleDynamicStrings(kv[0][0], ekv[0][0])
        this.__compareSimpleDynamicStrings(kv[0][1], ekv[0][1])
    }

    testSetFormDataBodyWithRichBody() {
        const importer = new BaseImporter()

        const requestMock = new PawRequestMock(null, '')
        const body = new Immutable.List([
            new KeyValue({
                key: 'key',
                value: 'value'
            }),
            new KeyValue({
                key: 'sec',
                value: 'ond'
            })
        ])

        importer._setFormDataBody(requestMock, body)
        this.__compareDynamicValuesInDynamicStrings(
            requestMock.body,
            new DynamicString(
                new DynamicValue(
                    'com.luckymarmot.BodyMultipartFormDataDynamicValue',
                    { keyValues: null }
                )
            ),
            [ 'type' ]
        )

        const kv = requestMock.body.components[0].keyValues
        const ekv = [
            [ new DynamicString('key'), new DynamicString('value'), true ],
            [ new DynamicString('sec'), new DynamicString('ond'), true ]
        ]

        this.assertEqual(kv.length, ekv.length)
        this.__compareSimpleDynamicStrings(kv[0][0], ekv[0][0])
        this.__compareSimpleDynamicStrings(kv[0][1], ekv[0][1])
        this.__compareSimpleDynamicStrings(kv[1][0], ekv[1][0])
        this.__compareSimpleDynamicStrings(kv[1][1], ekv[1][1])
    }

    testSetPlainBody() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'simple body'

        mockedImporter.spyOn('_toDynamicString', (arg) => {
            return arg
        })
        importer._setPlainBody.apply(
            mockedImporter,
            [ requestMock, body ]
        )

        this.assertEqual(mockedImporter.spy._toDynamicString.count, 1)
        this.assertEqual(
            mockedImporter.spy._toDynamicString.calls,
            [ [ 'simple body', true, true ] ]
        )
    }

    testSetJSONBody() {
        const importer = new BaseImporter()
        const body = {
            test: true
        }

        const requestMock = new PawRequestMock()

        importer._setJSONBody(requestMock, body)
        this.assertEqual(requestMock.body, body)
    }

    testSetSchemaBody() {
        const importer = new BaseImporter()
        const schemaRef = new SchemaReference()
        const mockedSchemaRef = new ClassMock(schemaRef, '')
        const requestMock = new PawRequestMock()

        mockedSchemaRef.spyOn('resolve', () => {
            return {
                toJS: () => { return 12 }
            }
        })
        const result = importer._setSchemaBody(requestMock, mockedSchemaRef, {
            schema: true
        })

        this.assertEqual(mockedSchemaRef.spy.resolve.count, 1)
        this.assertEqual(
            mockedSchemaRef.spy.resolve.calls,
            [ [ 1, { schema: true } ] ]
        )

        this.assertEqual(result.description, '### Schema ###\n\n12')
    }

    testSetUrlEncodedBody() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = new Immutable.List([
            new KeyValue({
                key: 'test',
                value: 'value'
            }),
            new KeyValue({
                key: 'sec',
                value: 'ond'
            })
        ])

        mockedImporter.spyOn('_toDynamicString', (arg) => {
            return arg
        })
        const result = importer._setUrlEncodedBody.apply(
            mockedImporter,
            [ requestMock, body ]
        )

        this.assertEqual(mockedImporter.spy._toDynamicString.count, 4)
        this.assertEqual(
            mockedImporter.spy._toDynamicString.calls,
            [
                [ 'test', true, true ],
                [ 'value', true, true ],
                [ 'sec', true, true ],
                [ 'ond', true, true ]
            ]
        )

        this.assertEqual(
            result.body.components[0].keyValues,
            [ [ 'test', 'value', true ], [ 'sec', 'ond', true ] ]
        )
    }

    testSetBodyWithformDataBodyType() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'dummy body'

        mockedImporter.spyOn('_setFormDataBody', () => {
            return 12
        })
        importer._setBody.apply(
            mockedImporter,
            [ requestMock, 'formData', body ]
        )

        this.assertEqual(mockedImporter.spy._setFormDataBody.count, 1)
        this.assertEqual(mockedImporter.spy._setFormDataBody.calls,
            [ [ requestMock, 'dummy body' ] ]
        )
    }

    testSetBodyWithurlEncodedBodyType() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'dummy body'

        mockedImporter.spyOn('_setUrlEncodedBody', () => {
            return 12
        })
        importer._setBody.apply(
            mockedImporter,
            [ requestMock, 'urlEncoded', body ]
        )

        this.assertEqual(mockedImporter.spy._setUrlEncodedBody.count, 1)
        this.assertEqual(mockedImporter.spy._setUrlEncodedBody.calls,
            [ [ requestMock, 'dummy body' ] ]
        )
    }

    testSetBodyWithJSONBodyType() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'dummy body'

        mockedImporter.spyOn('_setJSONBody', () => {
            return 12
        })
        importer._setBody.apply(
            mockedImporter,
            [ requestMock, 'json', body ]
        )

        this.assertEqual(mockedImporter.spy._setJSONBody.count, 1)
        this.assertEqual(mockedImporter.spy._setJSONBody.calls,
            [ [ requestMock, 'dummy body' ] ]
        )
    }

    testSetBodyWithPlainBodyType() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'dummy body'

        mockedImporter.spyOn('_setPlainBody', () => {
            return 12
        })
        importer._setBody.apply(
            mockedImporter,
            [ requestMock, 'plain', body ]
        )

        this.assertEqual(mockedImporter.spy._setPlainBody.count, 1)
        this.assertEqual(mockedImporter.spy._setPlainBody.calls,
            [ [ requestMock, 'dummy body' ] ]
        )
    }

    testSetBodyWithFileBodyType() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'dummy body'

        mockedImporter.spyOn('_setPlainBody', () => {
            return 12
        })
        importer._setBody.apply(
            mockedImporter,
            [ requestMock, 'file', body ]
        )

        this.assertEqual(mockedImporter.spy._setPlainBody.count, 1)
        this.assertEqual(mockedImporter.spy._setPlainBody.calls,
            [ [ requestMock, 'dummy body' ] ]
        )
    }

    testSetBodyWithSchemaBodyType() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const requestMock = new PawRequestMock()
        const body = 'dummy body'

        mockedImporter.spyOn('_setSchemaBody', () => {
            return 12
        })
        importer._setBody.apply(
            mockedImporter,
            [ requestMock, 'schema', body, { schema: true } ]
        )

        this.assertEqual(mockedImporter.spy._setSchemaBody.count, 1)
        this.assertEqual(mockedImporter.spy._setSchemaBody.calls,
            [ [ requestMock, 'dummy body', { schema: true } ] ]
        )
    }

    testImportPawRequest() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const contextMock = new PawContextMock()
        const request = new Request({
            url: 'dummyURL',
            method: 'POST',
            headers: new Immutable.OrderedMap({
                fake: 'header'
            }),
            auth: new Auth.Basic({
                username: 'marmot'
            }),
            bodyType: 'plain',
            body: 'dummy body'
        })

        mockedImporter.spyOn('_createPawRequest', (context, req) => {
            this.assertEqual(
                req.get('url'), 'dummyURL',
                req.get('method'), 'POST'
            )
            return {
                url: 'http://test.luckymarmot.com',
                method: 'GET'
            }
        })

        mockedImporter.spyOn('_setHeaders', (req, headers) => {
            this.assertEqual(headers, new Immutable.OrderedMap({
                fake: 'header'
            }))
            return {
                headers: {
                    fake: 'header'
                }
            }
        })

        mockedImporter.spyOn('_setAuth', (req, auth) => {
            this.assertEqual(
                auth, new Auth.Basic({
                    username: 'marmot'
                })
            )
            return {}
        })

        mockedImporter.spyOn('_setBody', (req, bodyType, body, schema) => {
            this.assertEqual(
                bodyType, 'plain'
            )
            this.assertEqual(
                body, 'dummy body'
            )
            this.assertEqual(
                schema, { schema: true }
            )
            return {}
        })

        importer._importPawRequest.apply(
            mockedImporter,
            [
                contextMock,
                null,
                { appendChild: () => {} },
                request,
                { schema: true }
            ]
        )

        this.assertEqual(mockedImporter.spy._createPawRequest.count, 1)
        this.assertEqual(mockedImporter.spy._setHeaders.count, 1)
        this.assertEqual(mockedImporter.spy._setAuth.count, 1)
        this.assertEqual(mockedImporter.spy._setBody.count, 1)
    }

    testApplyFuncOverGroupTree() {
        this.__loadTestSuite(
            'ApplyFuncOverGroupTree',
            '_applyFuncOverGroupTree'
        )
    }

    testImport() {
        const importer = new BaseImporter()

        const mockedImporter = new ClassMock(importer, '')
        const contextMock = new PawContextMock()

        const reqContext = new RequestContext()
        mockedImporter.spyOn('createRequestContext', () => {
            return reqContext
        })

        mockedImporter.spyOn('_importPawRequests', () => {})

        importer.import.apply(
            mockedImporter,
            [ contextMock, [ null ], null ]
        )

        this.assertEqual(mockedImporter.spy.createRequestContext.count, 1)
        this.assertEqual(mockedImporter.spy.createRequestContext.calls,
            [ [ contextMock, null, null ] ]
        )

        this.assertEqual(mockedImporter.spy._importPawRequests.count, 1)
        this.assertEqual(mockedImporter.spy._importPawRequests.calls,
            [ [ contextMock, reqContext, null, null ] ]
        )
    }

    //
    // helpers
    //

    __warnProgress(string, isTestCase = false) {
        let offset = isTestCase ? '    ' : '      '
        let warn =
            offset + '\x1b[33m\u25CB\x1b[0m \x1b[90m' +
            string + '\x1b[0m'
        /* eslint-disable no-console */
        console.log(warn)
        /* eslint-enable no-console */
    }

    __loadTestSuite(testSuitName, functionName) {
        const importer = new BaseImporter()
        let cases = BaseImporterFixtures['get' + testSuitName + 'Cases']()
        this.__warnProgress(testSuitName, true)
        for (let usecase of cases) {
            this.__warnProgress(usecase.name)
            let output = importer[functionName].apply(importer, usecase.inputs)
            this.assertEqual(output, usecase.output, 'in ' + usecase.name)
        }
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
