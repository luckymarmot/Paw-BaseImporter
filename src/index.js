import BaseImporter from './base-importer/BaseImporter'

import {
    Mock as _Mock,
    ClassMock,
    PawContextMock,
    PawRequestMock,
    DynamicValue,
    DynamicString,
    registerImporter
} from './paw-mocks/PawMocks'

import {
    registerImporter as registerShim,
    DynamicValue as DynValueShim,
    DynamicString as DynStringShim
} from './paw-mocks/PawShims'

export default BaseImporter
export const Mock = {
    Base: _Mock,
    ClassMock: ClassMock,
    PawRequest: PawRequestMock,
    PawContext: PawContextMock,
    DynamicValue: DynamicValue,
    DynamicString: DynamicString,
    registerImporter: registerImporter
}
export const Shim = {
    registerImporter: registerShim,
    DynamicString: DynStringShim,
    DynamicValue: DynValueShim
}
