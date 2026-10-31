import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FORM,
  buildGenerateConfig,
  buildTestngXml,
  downloadAllFiles,
  isNonBodyMethod,
  publicTypeNames,
  readGenerateResponse,
  resultFiles,
  suiteFileFromPom,
  validateForm,
  type CodeGenForm,
} from '@/lib/utils/codeGeneration';

const full = (patch: Partial<CodeGenForm> = {}): CodeGenForm => ({ ...DEFAULT_FORM, option: 'full', ...patch });
const ctx = { pojoDisabled: false };

describe('buildGenerateConfig (production contract)', () => {
  it('sends exactly the field set production sends, with serviceName and no className', () => {
    const config = buildGenerateConfig(full(), { dataFormat: 'json', pojoDisabled: false });
    expect(Object.keys(JSON.parse(JSON.stringify(config))).sort()).toEqual(
      [
        'assertResponseTime', 'assertionRequired', 'dataFormat', 'generatePom', 'includeRetry', 'loggingRequired',
        'maxResponseTimeMs', 'methodName', 'needPojo', 'option', 'serviceName', 'statusCode', 'testDescription',
        'testGroups', 'testPriority', 'useFluentApi',
      ].sort(),
    );
    expect(config).toMatchObject({
      option: 'full', serviceName: 'ApiTest', methodName: 'testApiRequest', statusCode: '200',
      testGroups: ['smoke'], testPriority: 1, useFluentApi: false, includeRetry: false, dataFormat: 'json',
      maxResponseTimeMs: 2000, assertResponseTime: false, generatePom: false, needPojo: false,
    });
    expect(config).not.toHaveProperty('className');
  });

  it('adds pojoClassName with POJOs on and pomConfig (production shape) with a POM', () => {
    const config = buildGenerateConfig(
      full({ needPojo: true, pojoClassName: 'UserRequest', generatePom: true, javaVersion: '17', testGroups: 'smoke, api ,' }),
      { dataFormat: 'both', pojoDisabled: false },
    );
    expect(config.pojoClassName).toBe('UserRequest');
    expect(config.testGroups).toEqual(['smoke', 'api']);
    expect(config.dataFormat).toBe('both');
    expect(config.pomConfig).toEqual({
      pomType: 'full',
      projectInfo: {
        groupId: 'com.example', artifactId: 'rest-assured-tests', version: '1.0-SNAPSHOT',
        name: 'REST Assured Test Project', description: 'Automated REST API tests using REST Assured',
      },
      includeJunit: false, includeAllure: false, includeExtent: false, includeExcel: false, includeFaker: false,
      includeLogging: true, includeCommonsIo: false, javaVersion: '17',
    });
  });

  it('forces a dependency-only POM for Method-only and never sends POJOs when they are disabled', () => {
    const config = buildGenerateConfig(
      { ...full({ needPojo: true, generatePom: true, pomType: 'full' }), option: 'method' },
      { dataFormat: 'json', pojoDisabled: true },
    );
    expect(config.pomConfig?.pomType).toBe('dependencies_only');
    expect(config.needPojo).toBe(false);
    expect(config).not.toHaveProperty('pojoClassName');
  });
});

describe('validateForm', () => {
  it('only validates fields that are in use (QF-9)', () => {
    const bad = { className: 'my class', pojoClassName: 'bad name!', groupId: '' };
    expect(validateForm(full(bad), ctx)).toMatchObject({ className: expect.any(String) });
    // Method-only: the class name is hidden
    expect(validateForm({ ...full(bad), option: 'method' }, ctx)).toEqual({});
    // POJO off: its name is not checked; POM off: coordinates are not checked
    expect(validateForm(full({ className: 'Ok', pojoClassName: 'bad name!' }), ctx)).toEqual({});
    expect(validateForm(full({ needPojo: true, pojoClassName: 'bad name!' }), ctx)).toHaveProperty('pojoClassName');
    // POJO disabled for the method: its name is not checked either
    expect(validateForm(full({ needPojo: true, pojoClassName: '' }), { pojoDisabled: true })).toEqual({});
  });

  it('requires coordinates only for a full POM of a full class', () => {
    const blank = { groupId: '', artifactId: ' ', version: '' };
    expect(Object.keys(validateForm(full({ ...blank, generatePom: true }), ctx))).toEqual(['groupId', 'artifactId', 'version']);
    expect(validateForm(full({ ...blank, generatePom: true, pomType: 'dependencies_only' }), ctx)).toEqual({});
    expect(validateForm({ ...full({ ...blank, generatePom: true }), option: 'method' }, ctx)).toEqual({});
  });

  it('checks status code and response time only when those options are on', () => {
    expect(validateForm(full({ statusCode: '99' }), ctx)).toHaveProperty('statusCode');
    expect(validateForm(full({ statusCode: '99', assertionRequired: false }), ctx)).toEqual({});
    expect(validateForm(full({ assertResponseTime: true, maxResponseTimeMs: '0' }), ctx)).toHaveProperty('maxResponseTimeMs');
    expect(validateForm(full({ assertResponseTime: false, maxResponseTimeMs: '' }), ctx)).toEqual({});
  });
});

describe('isNonBodyMethod', () => {
  it.each(['GET', 'delete', 'HEAD', 'OPTIONS'])('%s has no POJO', (m) => expect(isNonBodyMethod(m)).toBe(true));
  it.each(['POST', 'PUT', 'PATCH'])('%s keeps POJOs', (m) => expect(isNonBodyMethod(m)).toBe(false));
});

const TEST_CODE = `package com.acme.api;

import org.testng.annotations.*;

public class UserApiTest {
    @Test
    public void testApiRequest() {}
}`;

describe('result files', () => {
  const fullConfig = buildGenerateConfig(full({ needPojo: true, generatePom: true }), { dataFormat: 'json', pojoDisabled: false });
  const POM = '<project><suiteXmlFile>src/test/resources/testng.xml</suiteXmlFile></project>';
  const result = readGenerateResponse(
    { success: true, generated_code: TEST_CODE, pojo_code: 'public class RequestBody {}', pomXml: POM },
    fullConfig,
  );

  it('reads production response fields', () => {
    expect(result.testCode).toBe(TEST_CODE);
    expect(result.pojoCode).toContain('RequestBody');
    expect(result.pomXml).toBe(POM);
    expect(result.pomIsFull).toBe(true);
  });

  it('names Java files after the class inside and offers testng.xml with a full POM', () => {
    expect(resultFiles(result).map((f) => f.name)).toEqual([
      'UserApiTest.java', 'RequestBody.java', 'pom.xml', 'testng.xml',
    ]);
    expect(result.testngXml).toContain('<class name="com.acme.api.UserApiTest"/>');
    expect(result.testngHint).toContain('src/test/resources/testng.xml');
  });

  it('falls back to {Service}_Test and {Service}_Model when no public class can be found', () => {
    const r = readGenerateResponse({ success: true, generated_code: '@Test void a() {}', pojo_code: 'class A {}\nclass B {}' }, fullConfig);
    expect(resultFiles(r).map((f) => f.name)).toEqual(['ApiTest_Test.java', 'ApiTest_Model.java']);
  });

  it('has no testng.xml for a dependencies-only POM, and Download All leaves the fragment out', () => {
    const cfg = buildGenerateConfig(full({ generatePom: true, pomType: 'dependencies_only' }), { dataFormat: 'json', pojoDisabled: false });
    const r = readGenerateResponse({ success: true, generated_code: TEST_CODE, pomXml: '<dependencies/>' }, cfg);
    expect(r.testngXml).toBe('');
    expect(r.pomIsFull).toBe(false);
    expect(resultFiles(r).map((f) => f.name)).toEqual(['UserApiTest.java', 'pom-dependencies.xml']);
    expect(downloadAllFiles(r).map((f) => f.name)).toEqual(['UserApiTest.java']);
  });

  it('gives a Method-only result a downloadable snippet file', () => {
    const cfg = buildGenerateConfig({ ...full(), option: 'method' }, { dataFormat: 'json', pojoDisabled: false });
    const r = readGenerateResponse({ success: true, generated_code: '@Test\npublic void testApiRequest() {}' }, cfg);
    expect(resultFiles(r).map((f) => f.name)).toEqual(['testApiRequest.java']);
  });
});

describe('testng.xml', () => {
  it('escapes names and works without a package', () => {
    expect(buildTestngXml('public class A {}', 'A')).toContain('<class name="A"/>');
    expect(buildTestngXml('', 'My&Test')).toContain('<class name="My&amp;Test"/>');
  });
  it('finds the suite file a pom runs', () => {
    expect(suiteFileFromPom('<suiteXmlFile> testng.xml </suiteXmlFile>')).toBe('testng.xml');
    expect(suiteFileFromPom('<suiteXmlFile>${suite}</suiteXmlFile>')).toBeUndefined();
    expect(suiteFileFromPom('<project/>')).toBeUndefined();
  });
  it('lists only public top-level types', () => {
    expect(publicTypeNames('public final class A {}\nclass B {}\npublic interface C {}')).toEqual(['A', 'C']);
  });
});
