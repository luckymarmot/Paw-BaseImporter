import RequestContext, { FileReference, Auth, Request } from 'api-flow'

import {
    DynamicValue,
    DynamicString
} from '../paw-mocks/PawShims'

export default class BaseImporter {

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
        let url = this._generateUrl(
            request.get('url'),
            request.get('queries') || []
        )
        url = this._setAuthInUrl(
            url,
            request.get('auth') || [],
            request.get('queries') || []
        )
        return context.createRequest(
            request.get('name'),
            request.get('method'),
            this._toDynamicString(
                url,
                true,
                true
            ),
        )
    }

    _generateUrl(url, queries) {
        let _url = url
        if (queries && queries.length > 0) {
            _url += '?' + queries.map((keyValue) => {
                return keyValue.get('key') + '=' + (keyValue.get('value') || '')
            }).join('&')
        }
        return _url
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

    _setAuthInUrl(url, auths, queries) {
        let _url = url
        for (let auth of auths) {
            if (auth instanceof Auth.ApiKey) {
                if (auth.get('in') === 'query') {
                    let urlPart = ''
                    if (!queries || queries.length <= 0) {
                        urlPart += '?'
                    }
                    else {
                        urlPart += '&'
                    }
                    _url = _url + urlPart +
                        encodeURI(auth.get('name') || '') +
                        '=' +
                        encodeURI(auth.get('name') || '')
                }
            }
        }
        return _url
    }

    /*
        TODO: Add OAuth1 support when API-flow will support it
    */
    _setAuth(pawReq, auths) {
        for (let auth of auths) {
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
                const grantMap = {
                    accessCode: 0,
                    implicit: 1,
                    application: 2,
                    password: 3
                }
                const dv = new DynamicValue(
                    'com.luckymarmot.OAuth2DynamicValue',
                    {
                        grantType: grantMap[auth.get('flow')] || 0,
                        authorizationUrl: auth.get('authorizationUrl') || '',
                        accessTokenUrl: auth.get('tokenUrl') || '',
                        scope: (auth.get('scopes') || []).join(' ')
                    }
                )
                pawReq.setHeader('Authorization', new DynamicString(dv))
            }
            else if (auth instanceof Auth.ApiKey) {
                if (auth.get('in') === 'header') {
                    pawReq.setHeader('Authorization',
                        auth.get('name') + '=' + auth.get('key')
                    )
                }
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
        let keyValues = []
        for (let keyValue of body) {
            keyValues.push([
                this._toDynamicString(keyValue.get('key'), true, true),
                this._toDynamicString(keyValue.get('value'), true, true),
                true
            ])
        }
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
        _pawReq.description = (
            _pawReq.description ? _pawReq.description + '\n\n' : ''
        ) + '### Schema ###\n\n' +
        JSON.stringify(
            body.resolve(1, schema).toJS(), null, '  '
        )
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

    _setBody(pawReq, bodyType, body, schema) {
        const bodyRules = {
            formData: ::this._setFormDataBody,
            urlEncoded: ::this._setUrlEncodedBody,
            json: ::this._setJSONBody,
            plain: ::this._setPlainBody,
            file: ::this._setPlainBody,
            schema: (_pawReq, _body) => {
                return ::this._setSchemaBody(_pawReq, _body, schema)
            },
            null: (_pawReq) => { return _pawReq }
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

    _importPawRequest(context, options, parent, request, schema) {
        const headers = request.get('headers')
        const auth = request.get('auth')
        const bodyType = request.get('bodyType')
        const body = request.get('body')
        const timeout = request.get('timeout')

        // url + method
        let pawRequest = this._createPawRequest(context, request)

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
            schema
        )

        // timeout
        if (timeout) {
            pawRequest.timeout = timeout * 1000
        }

        parent.appendChild(pawRequest)

        // order
        if (options && options.order) {
            pawRequest.order = options.order
        }

        return pawRequest
    }

    _importPawRequests(context, requestContext, item, options) {
        const group = requestContext.get('group')
        const schema = requestContext.get('schema')

        let parent
        let name
        if (group.get('name')) {
            name = group.get('name')
        }
        else if (item && item.file) {
            name = item.file.name
        }
        else if (item && item.url) {
            name = item.url
        }
        parent = context.createRequestGroup(name)

        if (options && options.parent) {
            options.parent.appendChild(parent)
        }

        if (
            options &&
            options.order !== null &&
            typeof options.order !== 'undefined'
        ) {
            parent.order = options.order
        }

        this._applyFuncOverGroupTree(
            group,
            (request, requestParent) => {
                ::this._importPawRequest(
                    context,
                    options,
                    requestParent,
                    request,
                    schema
                )
            },
            (current, parentGroup) => {
                if (current === parentGroup.name) {
                    return parentGroup
                }
                let pawGroup = context.createRequestGroup(current)
                parentGroup.appendChild(pawGroup)
                return pawGroup
            },
            parent
        )
    }

    _applyFuncOverGroupTree(group, leafFunc, nodeFunc, pawGroup, depth = 0) {
        let calls = []
        // let _path = depth < 2 ? '' : pawGroup.name
        // _path = _path + (group.get('name') || '')

        let currentPawGroup = nodeFunc(group.get('name') || '', pawGroup)
        group.get('children').forEach((child) => {
            if (child instanceof Request) {
                calls.push(leafFunc(child, currentPawGroup))
            }
            else {
                calls = calls.concat(
                    this._applyFuncOverGroupTree(
                        child,
                        leafFunc,
                        nodeFunc,
                        currentPawGroup,
                        depth + 1
                    )
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
    createRequestContextFromString(context, string) {
        return this.createRequestContext(context, { content: string }, {})
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
        for (let item of items) {
            const requestContext = this.createRequestContext(
                context,
                item,
                options
            )
            if (!(requestContext instanceof RequestContext)) {
                throw new Error(
                    'createRequestContext ' +
                    'did not return an instance of RequestContext'
                )
            }
            this._importPawRequests(context, requestContext, item, options)
            if (options && options.order) {
                options.order += 1
            }
        }

        return true
    }
}
