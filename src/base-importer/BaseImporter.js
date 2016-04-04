import RequestContext, { FileReference, Auth } from 'api-flow'

import {
    registerImporter,
    DynamicValue,
    DynamicString
} from '../paw-mocks/PawShims'

@registerImporter // eslint-disable-line
export default class BaseImporter {
    static identifier = 'com.luckymarmot.PawExtensions.BaseImporter';
    static title = 'Base Importer';

    _resolveFileReference(value) {
        if (value instanceof FileReference) {
            const dv = new DynamicValue(
                'com.luckymarmot.FileContentDynamicValue', {}
            )
            const ds = new DynamicString(dv)
            return ds
        }
        return value
    }

    _convertCharToHex(char) {
        let hexChar = char.charCodeAt(0).toString(16)
        if (hexChar.length === 1) {
            hexChar = '0' + hexChar
        }
        return hexChar
    }

    _escapeCharSequence(seq) {
        const escapedChars = {
            '\n': '\\n',
            '\r': '\\r',
            '\t': '\\t'
        }
        let escapeSequence = ''
        for (let char of seq) {
            escapeSequence += escapedChars[char] ?
                escapedChars[char] :
                '\\x' + this._convertCharToHex(char)
        }
        return escapeSequence
    }

    _escapeSequenceDynamicValue(seq) {
        let escapeSequence = this._escapeCharSequence(seq)
        return new DynamicValue('com.luckymarmot.EscapeSequenceDynamicValue', {
            escapeSequence: escapeSequence
        })
    }

    _toDynamicString(string, defaultToEmpty, resolveFileRefs) {
        if (!string) {
            if (defaultToEmpty) {
                return new DynamicString('')
            }
            return null
        }

        // resolve file references
        if (resolveFileRefs) {
            const resolvedString = this._resolveFileReference(string)
            if (typeof resolvedString !== 'string') {
                return resolvedString
            }
        }

        // split around special characters
        const re = /([^\x00-\x1f]+)|([\x00-\x1f]+)/gm
        let components = []
        let m
        while ((m = re.exec(string)) !== null) {
            if (m[1]) {
                components.push(m[1])
            }
            else {
                components.push(this._escapeSequenceDynamicValue(m[2]))
            }
        }
        return new DynamicString(...components)
    }

    _createPawRequest(context, request) {
        return context.createRequest(
            request.get('name'),
            request.get('method'),
            this._toDynamicString(request.get('url'), true, true),
        )
    }

    _setHeaders(pawReq, headers) {
        headers.forEach((value, key) => {
            pawReq.setHeader(
                this._toDynamicString(key, true, true),
                this._toDynamicString(value, true, true)
            )
        })
        return pawReq
    }

    /*
        TODO: Add OAuth1 support when API-flow will support it
    */
    _setAuth(pawReq, auth) {
        if (auth) {
            if (auth instanceof Auth.Basic) {
                const dv = new DynamicValue(
                    'com.luckymarmot.BasicAuthDynamicValue',
                    {
                        username: auth.get('username', ''),
                        password: auth.get('password', '')
                    }
                )
                pawReq.setHeader('Authorization', new DynamicString(dv))
            }
            else if (auth instanceof Auth.OAuth2) {
                const dv = new DynamicValue(
                    'com.luckymarmot.OAuth2DynamicValue',
                    {
                        grant_clitype: auth.get('flow', ''),
                        authorization_uri: auth.get('authorizationUrl', ''),
                        access_token_uri: auth.get('tokenUrl', ''),
                        scope: (auth.get('scopes') || []).join(' ')
                    }
                )
                pawReq.setHeader('Authorization', new DynamicString(dv))
            }
            else {
                /* eslint-disable no-console */
                console.error(
                    'Auth type ' +
                    auth.get('type') +
                    ' is not supported in Paw'
                )
                /* eslint-enable no-console */
            }
        }
        return pawReq
    }

    _setFormDataBody(pawReq, body) {
        const keyValues = body.map((value, key) => {
            return [
                this._toDynamicString(key, true, true),
                this._toDynamicString(value, true, true),
                true
            ]
        }).toArray()
        const dv = new DynamicValue(
            'com.luckymarmot.BodyMultipartFormDataDynamicValue', {
                keyValues: keyValues
            }
        )
        pawReq.body = new DynamicString(dv)
        return pawReq
    }

    _setPlainBody(pawReq, body) {
        pawReq.body = this._toDynamicString(
            body, true, true
        )

        return pawReq
    }

    _setJSONBody(pawReq, body) {
        pawReq.body = body

        return pawReq
    }

    _setSchemaBody(pawReq, body, schema) {
        let _pawReq = pawReq
        if (!_pawReq.description) {
            _pawReq.description = body.resolve(schema)
        }
        return _pawReq
    }

    _setUrlEncodedBody(pawReq, body) {
        const keyValues = body.map(keyValue => {
            let key = this._toDynamicString(
                keyValue.get('key'), true, true
            )
            let value = this._toDynamicString(
                keyValue.get('value'), true, true
            )
            return [ key, value, true ]
        }).toArray()
        const dv = new DynamicValue(
            'com.luckymarmot.BodyFormKeyValueDynamicValue', {
                keyValues: keyValues
            }
        )
        pawReq.body = new DynamicString(dv)
        return pawReq
    }

    _setBody(pawReq, bodyType, body, bodyString, contentType, schema) {
        const bodyRules = {
            formData: this._setFormDataBody,
            urlEncoded: this._setUrlEncodedBody,
            json: this._setJSONBody,
            plain: this._setPlainBody,
            file: this._setPlainBody,
            schema: (_pawReq, _body) => {
                return this._setSchemaBody(_pawReq, _body, schema)
            }
        }

        let _pawReq = pawReq

        const rule = bodyRules[bodyType]
        if (rule) {
            _pawReq = rule(pawReq, body)
        }
        else {
            /* eslint-disable no-console */
            console.error(
                'Body type ' +
                    bodyType +
                ' is not supported in Paw'
            )
            /* eslint-enable no-console */
        }

        return _pawReq
    }

    _importPawRequest(context, options, request, schema) {
        const headers = request.get('headers')
        const auth = request.get('auth')
        const bodyType = request.get('bodyType')
        const body = request.get('body')
        const bodyString = request.get('bodyString')
        const contentType = headers.get('Content-Type')
        const timeout = request.get('timeout')

        // url + method
        let pawRequest = this.createRequest(context, request)

        pawRequest.description = request.get('description')

        // headers
        pawRequest = this._setHeaders(pawRequest, headers)

        // auth
        pawRequest = this._setAuth(pawRequest, auth)

        // body
        pawRequest = this._setBody(
            pawRequest,
            bodyType,
            body,
            bodyString,
            contentType,
            schema
        )

        // timeout
        if (timeout) {
            pawRequest.timeout = timeout * 1000
        }

        // parent
        if (options.parent) {
            pawRequest.parent = options.parent
        }

        // order
        if (options.order) {
            pawRequest.order = options.order
        }

        return pawRequest
    }

    _importPawRequests(context, requestContext, options) {
        const group = requestContext.get('group')
        const schema = requestContext.get('schema')
        this._applyFuncOverGroupTree(
            group,
            (request) => {
                this._importPawRequest(context, options, request, schema)
            }
        )
    }

    _applyFuncOverGroupTree(group, func) {
        let calls = []
        group.get('children').forEach((child) => {
            if (child instanceof Request) {
                calls.push(func(child))
            }
            else {
                calls = calls.concat(
                    this._applyFuncOverGroupTree(child, func)
                )
            }
        })
        return calls
    }

    static fileExtensions = [];
    static inputs = [];

    /*
      @params:
        - context
        - string
    */
    createRequestContextFromString() {
        throw new Error('BaseImporter is an abstract class')
    }

    importString(context, string) {
        const requestContext = this.createRequestContextFromString(
            context,
            string
        )
        if (!(requestContext instanceof RequestContext)) {
            throw new Error(
                'createRequestContextFromString ' +
                'did not return an instance of RequestContext'
            )
        }
        this._importPawRequests(context, requestContext)
        return true
    }

    /*
      @params:
        - context
        - items
        - options
    */
    createRequestContext() {
        throw new Error('BaseImporter is an abstract class')
    }

    import(context, items, options) {
        const requestContext = this.createRequestContext(
            context,
            items,
            options
        )
        if (!(requestContext instanceof RequestContext)) {
            throw new Error(
                'createRequestContext ' +
                'did not return an instance of RequestContext'
            )
        }
        this._importPawRequests(context, requestContext, options)
    }
}
