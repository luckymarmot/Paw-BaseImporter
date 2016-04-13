import RequestContext, {
    FileReference,
    Auth,
    Request,
    KeyValue,
    EnvironmentReference
} from 'api-flow'

import {
    DynamicValue,
    DynamicString
} from '../paw-mocks/PawShims'

export default class BaseImporter {
    static fileExtensions = [];
    static inputs = [];

    constructor() {
        this.ENVIRONMENT_DOMAIN_NAME = 'Imported Environments'
        this.context = null
    }

    /*
      @params:
        - context
        - string
    */
    createRequestContextFromString(context, string) {
        return this.createRequestContext(context, { content: string }, {})
    }

    // @not tested
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
        this._importPawRequests(requestContext)
        return true
    }

    /*
      @params:
        - requestContexts
        - context
        - items
        - options
    */
    createRequestContext() {
        throw new Error('BaseImporter is an abstract class')
    }

    // @tested 70%
    import(context, items, options) {
        let requestContexts = []
        for (let item of items) {
            requestContexts = this.createRequestContext(
                requestContexts,
                context,
                item,
                options
            )
        }

        this.context = context

        for (let env of requestContexts) {
            let requestContext = env.context

            if (!(requestContext instanceof RequestContext)) {
                throw new Error(
                    'createRequestContext ' +
                    'did not return an instance of RequestContext'
                )
            }
            this._importPawRequests(
                requestContext,
                env.items[0],
                options
            )
            if (options && options.order) {
                options.order += 1
            }
        }

        return true
    }

    // @not tested
    _importPawRequests(requestContext, item, options) {
        const group = requestContext.get('group')
        const schema = requestContext.get('schema')
        const environments = requestContext.get('environments')

        if (environments && environments.size > 0) {
            this._importEnvironments(environments)
        }

        if (group.get('children').size === 0) {
            return
        }

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

        parent = this.context.createRequestGroup(name)

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

        let manageRequestGroups = (current, parentGroup) => {
            if (current === parentGroup.name || current === '') {
                return parentGroup
            }
            let pawGroup = this.context.createRequestGroup(current)
            parentGroup.appendChild(pawGroup)
            return pawGroup
        }

        this._applyFuncOverGroupTree(
            group,
            (request, requestParent) => {
                ::this._importPawRequest(
                    options,
                    requestParent,
                    request,
                    schema
                )
            },
            manageRequestGroups,
            parent
        )
    }

    // @not tested
    _importEnvironments(environments) {
        const domainName = this.ENVIRONMENT_DOMAIN_NAME
        let environmentDomain = this.context
            .getEnvironmentDomainByName(domainName)

        if (!environmentDomain) {
            environmentDomain = this.context.createEnvironmentDomain(domainName)
        }

        for (let env of environments) {
            let pawEnv = environmentDomain.createEnvironment(env.name)
            let variablesDict = {}
            env.get('variables').forEach(
                value => {
                    variablesDict[value.get('key')] = value.get('value')
                }
            )
            pawEnv.setVariablesValues(variablesDict)
        }
    }

    // @tested
    _getEnvironmentDomain() {
        let env = this.context.getEnvironmentDomainByName(
            this.ENVIRONMENT_DOMAIN_NAME
        )
        if (typeof env === 'undefined') {
            env = this.context
                .createEnvironmentDomain(this.ENVIRONMENT_DOMAIN_NAME)
        }
        return env
    }

    // @tested
    _getEnvironment(domain, environmentName = 'Default Environment') {
        let env = domain.getEnvironmentByName(environmentName)
        if (typeof env === 'undefined') {
            env = domain.createEnvironment(environmentName)
        }
        return env
    }

    // @tested
    _getEnvironmentVariable(name) {
        let domain = this._getEnvironmentDomain()
        let variable = domain.getVariableByName(name)
        if (typeof variable === 'undefined') {
            let env = this._getEnvironment(domain)
            let varD = {}
            varD[name] = ''
            env.setVariablesValues(varD)
            variable = domain.getVariableByName(name)
        }
        return variable
    }

    // @tested 80%
    _importPawRequest(options, parent, request, schema) {
        const headers = request.get('headers')
        const auth = request.get('auth')
        const bodyType = request.get('bodyType')
        const body = request.get('body')
        const timeout = request.get('timeout')

        // url + method
        let pawRequest = this._createPawRequest(request)

        pawRequest.description = request.get('description')

        // headers
        pawRequest = this._setHeaders(pawRequest, headers)

        // auth
        pawRequest = ::this._setAuth(pawRequest, auth)

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

    // @tested
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

    // @tested
    _createPawRequest(request) {
        let url = ::this._generateUrl(
            request.get('url'),
            request.get('queries'),
            request.get('auth')
        )
        return this.context.createRequest(
            request.get('name'),
            request.get('method'),
            url,
        )
    }

    // @tested 70% (encodeURI behavior not tested)
    _generateUrl(url, queries, auths) {
        let _url = this._toDynamicString(url, true, true)

        let queryParams = (queries || []).concat(
            this._extractQueryParamsFromAuth(auths)
        )
        if (queryParams.size > 0) {
            _url.appendString('?')
            let _params = queryParams.reduce(
                (params, keyValue) => {
                    let dynKey = this._toDynamicString(
                        keyValue.get('key'), true, true
                    ).components.map((component) => {
                        if (typeof component === 'string') {
                            return encodeURI(component)
                        }
                        return component
                    })
                    let dynValue = this._toDynamicString(
                        keyValue.get('value'), true, true
                    ).components.map((component) => {
                        if (typeof component === 'string') {
                            return encodeURI(component)
                        }
                        return component
                    })
                    let param = []
                    if (params.length !== 0) {
                        param.push('&')
                    }
                    param = param.concat(dynKey)
                    param.push('=')
                    param = param.concat(dynValue)
                    return params.concat(param)
                },
                []
            )
            _url = new DynamicString(..._url.components, ..._params)
        }

        return _url
    }

    // @tested
    _extractQueryParamsFromAuth(auths) {
        return (auths || []).filter((auth) => {
            return auth instanceof Auth.ApiKey && auth.get('in') === 'query'
        }).map((auth) => {
            return new KeyValue({
                key: auth.get('name'),
                value: auth.get('key')
            })
        }).toArray()
    }

    // @tested
    _setHeaders(pawReq, headers) {
        headers.forEach((value, key) => {
            pawReq.setHeader(
                this._toDynamicString(key, true, true),
                this._toDynamicString(value, true, true)
            )
        })
        return pawReq
    }

    // @tested
    _setBasicAuth(auth) {
        return new DynamicValue(
            'com.luckymarmot.BasicAuthDynamicValue',
            {
                username: auth.get('username') || '',
                password: auth.get('password') || ''
            }
        )
    }

    // @tested
    _setDigestAuth(auth) {
        return new DynamicValue(
            'com.luckymarmot.PawExtensions.DigestAuthDynamicValue',
            {
                username: auth.get('username'),
                password: auth.get('password')
            }
        )
    }

    // @tested
    _setOAuth1Auth(auth) {
        return new DynamicValue(
            'com.luckymarmot.OAuth1HeaderDynamicValue',
            {
                callback: auth.get('callback') || '',
                consumerKey: auth.get('consumerKey') || '',
                consumerSecret: auth.get('consumerSecret') || '',
                tokenSecret: auth.get('tokenSecret') || '',
                algorithm: auth.get('algorithm') || '',
                nonce: auth.get('nonce') || '',
                additionalParamaters: auth
                    .get('additionalParamaters') || '',
                timestamp: auth.get('timestamp') || '',
                token: auth.get('token') || ''
            }
        )
    }

    // @tested
    _setOAuth2Auth(auth) {
        const grantMap = {
            accessCode: 0,
            implicit: 1,
            application: 2,
            password: 3
        }
        return new DynamicValue(
            'com.luckymarmot.OAuth2DynamicValue',
            {
                grantType: grantMap[auth.get('flow')] || 0,
                authorizationUrl: auth.get('authorizationUrl') || '',
                accessTokenUrl: auth.get('tokenUrl') || '',
                scope: (auth.get('scopes') || []).join(' ')
            }
        )
    }

    // @tested
    _setAWSSig4Auth(auth) {
        return new DynamicValue(
            'com.shigeoka.PawExtensions.AWSSignature4DynamicValue',
            {
                key: auth.get('key') || '',
                secret: auth.get('secret') || '',
                region: auth.get('region') || '',
                service: auth.get('service') || ''
            }
        )
    }

    // @tested
    _setHawkAuth(auth) {
        return new DynamicValue(
            'uk.co.jalada.PawExtensions.HawkDynamicValue',
            {
                key: auth.get('key') || '',
                id: auth.get('id') || '',
                algorithm: auth.get('algorithm') || ''
            }
        )
    }

    // @tested
    _setAuth(pawReq, auths) {
        const authTypeMap = {
            BasicAuth: this._setBasicAuth,
            DigestAuth: this._setDigestAuth,
            OAuth1Auth: this._setOAuth1Auth,
            OAuth2Auth: this._setOAuth2Auth,
            AWSSig4Auth: this._setAWSSig4Auth,
            HawkAuth: this._setHawkAuth
        }

        for (let auth of auths) {
            let rule = authTypeMap[auth.constructor.name]

            if (rule) {
                const dv = rule(auth)
                pawReq.setHeader('Authorization', new DynamicString(dv))
            }
            else if (auth instanceof Auth.ApiKey) {
                if (auth.get('in') === 'header') {
                    pawReq.setHeader(
                        this._toDynamicString(auth.get('name'), true, true),
                        this._toDynamicString(auth.get('key'), true, true)
                    )
                }
            }
            else {
                /* eslint-disable no-console */
                console.error(
                    'Auth type ' +
                    auth.constructor.name +
                    ' is not supported in Paw'
                )
                /* eslint-enable no-console */
            }
        }
        return pawReq
    }

    // @tested
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

    // @tested
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

    // @tested
    _setPlainBody(pawReq, body) {
        pawReq.body = this._toDynamicString(
            body || '', true, true
        )

        return pawReq
    }

    // @tested
    _setJSONBody(pawReq, body) {
        pawReq.body = body

        return pawReq
    }

    // @tested
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

    // @tested
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

    // @tested
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
            if (
                typeof resolvedString !== 'string' &&
                resolvedString instanceof DynamicString
            ) {
                return resolvedString
            }
        }

        let envComponents = []
        if (
            typeof string !== 'string' &&
            string instanceof EnvironmentReference
        ) {
            envComponents = this._castReferenceToDynamicString(
                string
            ).components
        }
        else {
            envComponents.push(string)
        }

        let components = []
        for (let component of envComponents) {
            if (typeof component !== 'string') {
                components.push(component)
            }
            else {
                // split around special characters
                const re = /([^\x00-\x1f]+)|([\x00-\x1f]+)/gm
                let m
                while ((m = re.exec(component)) !== null) {
                    if (m[1]) {
                        components.push(m[1])
                    }
                    else {
                        components.push(this._escapeSequenceDynamicValue(m[2]))
                    }
                }
            }
        }


        return new DynamicString(...components)
    }

    // @tested
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

    // @tested
    _convertCharToHex(char) {
        let hexChar = char.charCodeAt(0).toString(16)
        if (hexChar.length === 1) {
            hexChar = '0' + hexChar
        }
        return hexChar
    }

    // @tested
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

    // @tested
    _escapeSequenceDynamicValue(seq) {
        let escapeSequence = this._escapeCharSequence(seq)
        return new DynamicValue('com.luckymarmot.EscapeSequenceDynamicValue', {
            escapeSequence: escapeSequence
        })
    }

    // @tested
    _castReferenceToDynamicString(reference) {
        let components = reference.get('referenceName')
        let dynStr = []

        components.forEach((component) => {
            let value = this._extractReferenceComponent(component)
            if (value) {
                dynStr.push(value)
            }
        })
        return new DynamicString(...dynStr)
    }


    /*
        This does not extract all reference components,
        but only the simple ones. e.g. a {{var1}} will
        be extracted as var1, but {{{{var2}}}} won't.
        {{var{{number}}}} also won't be extracted.

        This is because Paw does not support variable
        environment references: {{var{{number}}}} could
        resolve to {{var1}}, {{var2}}, etc. depending on
        the value {{number}} resolves to, and we can't
        know if they exist, as {{number}} can be changed
        on the fly by the user.
    */
    // @tested
    _extractReferenceComponent(component) {
        if (typeof component === 'string') {
            return component
        }

        if (component instanceof EnvironmentReference &&
            component.get('referenceName').size === 1 &&
            typeof component.getIn([ 'referenceName', 0 ]) === 'string'
        ) {
            let envVariable = this._getEnvironmentVariable(
                component.getIn([ 'referenceName', 0 ])
            )
            return new DynamicValue(
                'com.luckymarmot.EnvironmentVariableDynamicValue',
                {
                    environmentVariable: envVariable.id
                }
            )
        }

        return null
    }
}
