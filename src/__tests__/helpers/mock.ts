import {jest} from "@jest/globals";
/** Preserve the real callable signature when mocking an SDK or component callback. */
export function mockOf<T extends (...args:never[])=>unknown>(){return jest.fn<T>();}
/** Query tests use explicit selected-row projections; arguments are asserted at runtime. */
export function mockQuery<Row>(){return jest.fn<(...args:unknown[])=>Promise<Row>>();}
