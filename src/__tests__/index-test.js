import Immutable from 'immutable'
import { UnitTest, registerTest } from '../../utils/TestUtils'

@registerTest
export class TestRepositoryIndex extends UnitTest {
    testImportsNotForgotten() {
        const _module = require('../index.js')

        const architecture = {
            Mock: {
                Base: null,
                ClassMock: null,
                PawRequest: null,
                PawContext: null,
                DynamicValue: null,
                DynamicString: null,
                registerImporter: null
            },
            Shim: {
                registerImporter: null,
                DynamicValue: null,
                DynamicString: null
            },
            default: null
        }

        let immutModule = Immutable.fromJS(_module)
        let architectureMap = immutModule.mergeDeep(architecture)

        this.assertEqual(architectureMap, architecture)
    }

    testImportsAllPresent() {
        const _module = require('../index.js')

        const architecture = { // eslint-disable-line
            Mock: {
                Base: this.assertTrue(!!_module.Mock.Base),
                ClassMock: this.assertTrue(!!_module.Mock.ClassMock),
                PawRequest: this.assertTrue(!!_module.Mock.PawRequest),
                PawContext: this.assertTrue(!!_module.Mock.PawContext),
                DynamicValue: this.assertTrue(!!_module.Mock.DynamicValue),
                DynamicString: this.assertTrue(!!_module.Mock.DynamicString),
                registerImporter:
                    this.assertTrue(!!_module.Mock.registerImporter),
                dummy: this.assertTrue(!!_module.Mock.Base)
            },
            Shim: {
                registerImporter:
                    this.assertTrue(!!_module.Shim.registerImporter),
                DynamicValue: this.assertTrue(!!_module.Shim.DynamicValue),
                DynamicString: this.assertTrue(!!_module.Shim.DynamicString)
            },
            default: this.assertTrue(!!_module.default)
        }
    }
}
