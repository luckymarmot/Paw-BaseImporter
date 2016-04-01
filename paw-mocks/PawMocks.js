export class Mock {
    constructor(obj, prefix = '$$_') {
        let spies = {}
        for (let field in obj) {
            if (
                obj.hasOwnProperty(field) &&
                typeof obj[field] === 'function'
            ) {
                spies[field] = {
                    count: 0,
                    calls: [],
                    func: () => {}
                }
            }
        }

        this[prefix + 'spy'] = spies

        const setupFuncSpy = (field) => {
            return (...args) => {
                this[prefix + 'spy'][field].count += 1
                this[prefix + 'spy'][field].calls.push(args)
                return this[prefix + 'spy'][field].func(...args)
            }
        }

        for (let field in obj) {
            if (obj.hasOwnProperty(field)) {
                if (typeof obj[field] === 'function') {
                    this[field] = setupFuncSpy(field)
                }
                else {
                    this[field] = obj[field]
                }
            }
        }

        this[prefix + 'spyOn'] = (field, func) => {
            this[prefix + 'spy'][field].func = func
            return this
        }

        this[prefix + 'getSpy'] = (field) => {
            return this[prefix + 'spy'][field]
        }
    }
}

export class PawContextMock extends Mock {
    constructor(baseObj, prefix) {
        let obj = {
            getCurrentRequest: Function,
            getRequestByName: Function,
            getRequestGroupByName: Function,
            getRootRequestTreeItems: Function,
            getRootRequests: Function,
            getAllRequests: Function,
            getAllGroups: Function,
            getEnvironmentDomainByName: Function,
            getEnvironmentVariableByName: Function,
            getRequestById: Function,
            getRequestGroupById: Function,
            getEnvironmentDomainById: Function,
            getEnvironmentVariableById: Function,
            getEnvironmentById: Function,
            createRequest: Function,
            createRequestGroup: Function,
            createEnvironmentDomain: Function
        }
        Object.assign(obj, baseObj)
        super(obj, prefix)
    }
}

export class PawRequestMock extends Mock {
    constructor(baseObj, prefix) {
        let obj = {
            id: null,
            name: null,
            order: null,
            parent: null,
            url: null,
            method: null,
            headers: null,
            httpBasicAuth: null,
            oauth1: null,
            oauth2: null,
            body: null,
            urlEncodedBody: null,
            multipartBody: null,
            jsonBody: null,
            timeout: null,
            followRedirects: null,
            redirectAuthorization: null,
            redirectMethod: null,
            sendCookies: null,
            storeCookies: null,
            getUrl: Function,
            getHeaders: Function,
            getHeaderByName: Function,
            setHeader: Function,
            getHttpBasicAuth: Function,
            getOAuth1: Function,
            getOAuth2: Function,
            getBody: Function,
            getUrlEncodedBody: Function,
            getMultipartBody: Function,
            getLastExchange: Function
        }
        Object.assign(obj, baseObj)
        super(obj, prefix)
    }
}
