import type { Page } from '@playwright/test';
import {
  test,
  expect,
  parseToEditor,
  openCodegen,
  generate,
  shownCode,
  clipboard,
  collectDownloads,
  downloadText,
  ApiLog,
  CHROME_BASH,
  SECRETS,
  SIMPLE_GET,
  SIMPLE_POST,
  XML_PUT,
} from './support/live';

/**
 * Code Generation dialog against the real generator: every option is checked in the Java / XML
 * that comes back, in the config the frontend sends, and in the downloaded files.
 */

interface SentConfig {
  option: string;
  serviceName: string;
  methodName: string;
  statusCode: string;
  assertionRequired: boolean;
  loggingRequired: boolean;
  needPojo: boolean;
  pojoClassName?: string;
  testGroups: string[];
  assertResponseTime: boolean;
  maxResponseTimeMs?: number;
  generatePom: boolean;
  dataFormat: string;
  pomConfig?: { pomType: string; javaVersion: string; projectInfo: { groupId: string; artifactId: string; version: string } };
}

const lastConfig = async (api: ApiLog) => {
  await api.settle();
  return (api.of('/api/generate-from-parsed').at(-1)!.body as { config: SentConfig }).config;
};

const dialog = (page: Page) => page.getByRole('dialog');
const advanced = (page: Page) => dialog(page).getByRole('button', { name: /Maven & advanced/ });
const tab = (page: Page, name: string) => dialog(page).getByRole('tab', { name, exact: true });

/** Download the active tab's file. */
async function downloadActive(page: Page) {
  const [file] = await Promise.all([page.waitForEvent('download'), dialog(page).getByRole('button', { name: 'Download', exact: true }).click()]);
  return { name: file.suggestedFilename(), text: await downloadText(file) };
}

test.describe('Code generation: test class and method', () => {
  test('[CG-01][CG-18][CG-22] Full Test Class from a Chrome copy: every part of the request is in the Java', async ({ page, api }) => {
    await parseToEditor(page, CHROME_BASH);
    await openCodegen(page);
    await expect(dialog(page).getByRole('button', { name: 'Generate Code', exact: true })).toBeDisabled();
    await page.locator('#option-full').check();
    await expect(page.locator('#class-name')).toHaveValue('ApiTest');
    await expect(page.locator('#method-name')).toHaveValue('testApiRequest');
    await generate(page);
    await expect(page.getByRole('dialog').locator('[aria-live="polite"]')).toHaveText(/Code generation complete/);
    await expect(tab(page, 'Test Code')).toHaveAttribute('aria-selected', 'true');

    expect(await lastConfig(api)).toMatchObject({
      option: 'full',
      serviceName: 'ApiTest',
      methodName: 'testApiRequest',
      statusCode: '200',
      assertionRequired: true,
      loggingRequired: true,
      needPojo: false,
      testGroups: ['smoke'],
      generatePom: false,
      dataFormat: 'json',
    });

    await dialog(page).getByRole('button', { name: 'Reveal value of generated code' }).click();
    const code = await shownCode(page);
    expect(code).toMatch(/public class ApiTest\w*\s*\{/);
    expect(code).toContain('@BeforeClass');
    expect(code).toContain('RestAssured.baseURI = "https://api.shop.example.com"');
    expect(code).toMatch(/@Test\([^)]*groups = \{"smoke"\}/);
    expect(code).toContain('public void testApiRequest()');
    for (const [name, value] of [
      ['accept-language', 'en-GB,en;q=0.9'],
      ['authorization', `Bearer ${SECRETS.bearer}`],
      ['origin', 'https://shop.example.com'],
    ]) expect(code).toContain(`"${name}", "${value}"`);
    expect(code).toContain('queryParam("expand", "items")');
    expect(code).toContain('queryParam("page", "2")');
    expect(code).toContain(`cookie("session_id", "${SECRETS.cookie}")`);
    expect(code).toContain('cookie("theme", "dark")');
    expect(code).toContain('SKU-BLU-07');
    expect(code).toContain('Bengaluru');
    expect(code).toContain('.post("/v2/orders")');
    expect(code).toContain('Assert.assertEquals(statusCode, 200');
    expect(code).toContain('log().all()');
  });

  test('[CG-02][CG-03] Method Only with custom names: a bare method and a file named after it', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_GET);
    await openCodegen(page);
    await page.locator('#option-method').check();
    await expect(page.locator('#class-name')).toHaveCount(0);
    await page.locator('#method-name').fill('getUserProfile');
    await generate(page);
    const code = await shownCode(page);
    expect(code).toContain('public void getUserProfile()');
    expect(code).not.toMatch(/public class /);
    expect(code).toContain('/users/42');
    expect(await lastConfig(api)).toMatchObject({ option: 'method', methodName: 'getUserProfile' });
    const file = await downloadActive(page);
    expect(file.name).toBe('getUserProfile.java');
    expect(file.text).toContain('public void getUserProfile()');
    expect(file.text).not.toMatch(/public class /);
  });

  test('[CG-03] a custom class name is used in the code and the file name', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await page.locator('#class-name').fill('UserOnboardingTest');
    await page.locator('#method-name').fill('createsUser');
    await generate(page);
    const code = await shownCode(page);
    const cls = code.match(/public class (\w+)/)![1]!;
    expect(cls).toMatch(/^UserOnboardingTest/);
    expect(code).toContain('public void createsUser()');
    const file = await downloadActive(page);
    expect(file.name).toBe(`${cls}.java`);
    expect(file.text).toContain(`public class ${cls}`);
  });

  test('[CG-04] invalid names and status codes are explained and block nothing that is hidden', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await page.locator('#class-name').fill('123 Bad');
    await page.locator('#method-name').fill('');
    await page.locator('#status-code').fill('42');
    await dialog(page).getByRole('button', { name: 'Generate Code', exact: true }).click();

    await expect(dialog(page).getByRole('alert')).toHaveText('Fix the 3 highlighted fields above, then generate again.');
    await expect(page.locator('#class-name-error')).toHaveText('Must be a valid Java identifier (no spaces or special characters)');
    await expect(page.locator('#method-name-error')).toHaveText('Required');
    await expect(page.locator('#status-code-error')).toHaveText('Enter a status code between 100 and 599');
    await expect(page.locator('#class-name')).toBeFocused();
    await expect(page.locator('#class-name')).toHaveAttribute('aria-describedby', 'class-name-error');
    await api.settle();
    expect(api.of('/api/generate-from-parsed')).toHaveLength(0);

  });

  test('[CG-04] in Method Only an invalid (hidden) class name does not block generation (BUG-E2E-09)', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await page.locator('#class-name').fill('123 Bad');
    await page.locator('#option-method').check();
    await expect(page.locator('#class-name')).toHaveCount(0);
    await page.getByRole('dialog').getByRole('button', { name: 'Generate Code', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('[CG-07][CG-08] assertions and logging can be turned off; a custom status is asserted', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await page.locator('#status-code').fill('201');
    await generate(page);
    let code = await shownCode(page);
    expect(code).toContain('Assert.assertEquals(statusCode, 201');

    await dialog(page).getByRole('button', { name: '← Back to Config' }).click();
    await expect(page.locator('#status-code')).toHaveValue('201'); // choices are kept
    await dialog(page).getByRole('checkbox', { name: 'Include Assertions' }).click();
    await expect(page.locator('#status-code')).toHaveCount(0);
    await dialog(page).getByRole('checkbox', { name: 'Include Logging' }).click();
    await generate(page);
    code = await shownCode(page);
    expect(await lastConfig(api)).toMatchObject({ assertionRequired: false, loggingRequired: false });
    expect(code).not.toContain('Assert.assertEquals(statusCode');
    expect(code).not.toContain('log().all()');
  });

  test('[CG-09][CG-10] response-time check and TestNG groups reach the @Test', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await advanced(page).click();
    await dialog(page).getByRole('checkbox', { name: 'Response time check' }).click();
    await page.locator('#max-response-time').fill('0');
    await page.locator('#test-groups').fill('regression, payments ,  ');
    await dialog(page).getByRole('button', { name: 'Generate Code', exact: true }).click();
    await expect(page.locator('#max-response-time-error')).toHaveText('Enter a maximum response time above 0 ms');
    await page.locator('#max-response-time').fill('1500');
    await generate(page);

    expect(await lastConfig(api)).toMatchObject({ assertResponseTime: true, maxResponseTimeMs: 1500, testGroups: ['regression', 'payments'] });
    const code = await shownCode(page);
    expect(code).toMatch(/groups = \{"regression", "payments"\}/);
    expect(code).toContain('responseTime < 1500');
  });
});

test.describe('Code generation: POJO, POM, testng.xml', () => {
  test('[CG-05] POJOs: Lombok classes named as asked, nested types inside, used by the test', async ({ page, api }) => {
    await parseToEditor(page, CHROME_BASH);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await dialog(page).getByRole('checkbox', { name: 'Generate POJO Classes' }).click();
    await expect(page.locator('#pojo-class-name')).toHaveValue('RequestBody');
    await page.locator('#pojo-class-name').fill('CreateOrderRequest');
    await generate(page);
    expect(await lastConfig(api)).toMatchObject({ needPojo: true, pojoClassName: 'CreateOrderRequest' });

    const test = await shownCode(page);
    expect(test).toContain('CreateOrderRequest.builder()');
    await tab(page, 'POJO Classes').click();
    const pojo = await shownCode(page);
    expect(pojo).toContain('@Data');
    expect(pojo).toContain('@Builder');
    expect(pojo).toContain('public class CreateOrderRequest');
    expect(pojo).toMatch(/public static class Shipping/);
    expect(pojo).toMatch(/private List<\w+> items;/);
    const file = await downloadActive(page);
    expect(file.name).toBe('CreateOrderRequest.java');
    expect(file.text).toContain('public class CreateOrderRequest');
  });

  test('[CG-06] POJOs are not offered for a GET', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_GET);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await expect(dialog(page).getByRole('checkbox', { name: 'Generate POJO Classes' })).toBeDisabled();
    await expect(dialog(page).getByText('Not available for GET/DELETE/HEAD')).toBeVisible();
    await generate(page);
    expect((await lastConfig(api)).needPojo).toBe(false);
    await expect(tab(page, 'POJO Classes')).toHaveCount(0);
  });

  test('[CG-11] full pom.xml with the chosen coordinates and Java version, a matching testng.xml, Download All', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await page.locator('#class-name').fill('UsersApiTest');
    await dialog(page).getByRole('checkbox', { name: 'Generate POJO Classes' }).click();
    await page.locator('#pojo-class-name').fill('NewUser');
    await advanced(page).click();
    await dialog(page).getByRole('checkbox', { name: 'Generate pom.xml' }).click();
    await page.locator('#java-version').selectOption('17');
    await page.locator('#pom-group-id').fill('in.kotak.qa');
    await page.locator('#pom-artifact-id').fill('users-api-tests');
    await page.locator('#pom-version').fill('3.1.4');
    await generate(page);

    expect((await lastConfig(api)).pomConfig).toMatchObject({
      pomType: 'full',
      javaVersion: '17',
      projectInfo: { groupId: 'in.kotak.qa', artifactId: 'users-api-tests', version: '3.1.4' },
    });
    const cls = (await shownCode(page)).match(/public class (\w+)/)![1]!;

    await tab(page, 'pom.xml').click();
    const pom = await shownCode(page);
    expect(pom).toContain('<groupId>in.kotak.qa</groupId>');
    expect(pom).toContain('<artifactId>users-api-tests</artifactId>');
    expect(pom).toContain('<version>3.1.4</version>');
    expect(pom).toContain('<maven.compiler.source>17</maven.compiler.source>');
    for (const dep of ['rest-assured', 'testng', 'lombok', 'jackson-databind']) expect(pom).toContain(`<artifactId>${dep}</artifactId>`);
    expect(pom).toContain('<suiteXmlFile>testng.xml</suiteXmlFile>');

    await tab(page, 'testng.xml').click();
    await expect(dialog(page).getByText(/The generated pom.xml runs testng.xml/)).toBeVisible();
    const testng = await shownCode(page);
    expect(testng).toContain(`<class name="${cls}"/>`);

    const files = await collectDownloads(page, 4, () => dialog(page).getByRole('button', { name: 'Download All' }).click());
    expect(Object.keys(files).sort()).toEqual([`${cls}.java`, 'NewUser.java', 'pom.xml', 'testng.xml'].sort());
    expect(files['pom.xml']).toContain('<groupId>in.kotak.qa</groupId>');
    expect(files['testng.xml']).toContain(`<class name="${cls}"/>`);
    expect(files[`${cls}.java`]).toContain('NewUser.builder()');
    expect(files['NewUser.java']).toContain('public class NewUser');
  });

  test('[CG-13] a full POM needs its coordinates; the hidden section is opened to show the problem', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await advanced(page).click();
    await dialog(page).getByRole('checkbox', { name: 'Generate pom.xml' }).click();
    await page.locator('#pom-group-id').fill('');
    await page.locator('#pom-version').fill(' ');
    await advanced(page).click(); // collapse it again
    await expect(page.locator('#pom-group-id')).toHaveCount(0);
    await dialog(page).getByRole('button', { name: 'Generate Code', exact: true }).click();
    await expect(page.locator('#pom-group-id')).toBeFocused();
    await expect(page.locator('#pom-group-id-error')).toHaveText('Required');
    await expect(page.locator('#pom-version-error')).toHaveText('Required');
  });

  test('[CG-12] dependencies-only POM: its own tab and file, left out of Download All; Method Only forces it', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await advanced(page).click();
    await dialog(page).getByRole('checkbox', { name: 'Generate pom.xml' }).click();
    await page.locator('#pom-type').selectOption('dependencies_only');
    await expect(page.locator('#pom-group-id')).toHaveCount(0);
    await generate(page);
    expect((await lastConfig(api)).pomConfig!.pomType).toBe('dependencies_only');
    await tab(page, 'Dependencies (pom.xml)').click();
    const deps = await shownCode(page);
    expect(deps).toContain('<artifactId>rest-assured</artifactId>');
    expect(deps).not.toContain('<project');
    await expect(tab(page, 'testng.xml')).toHaveCount(0);
    expect((await downloadActive(page)).name).toBe('pom-dependencies.xml');
    // Only the test class is left for Download All, so the button is not offered.
    await expect(dialog(page).getByRole('button', { name: 'Download All' })).toHaveCount(0);

    await dialog(page).getByRole('button', { name: '← Back to Config' }).click();
    await page.locator('#option-method').check();
    await expect(page.locator('#pom-type')).toBeDisabled();
    await expect(page.locator('#pom-type')).toHaveValue('dependencies_only');
    await generate(page);
    expect((await lastConfig(api)).pomConfig!.pomType).toBe('dependencies_only');
  });

  test('[CG-14] XML bodies are detected; the format can be overridden and reset', async ({ page, api }) => {
    await parseToEditor(page, XML_PUT);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await advanced(page).click();
    await expect(dialog(page).getByText(/Auto-detected: XML/)).toBeVisible();
    await expect(page.locator('#data-format-xml')).toBeChecked();
    await expect(dialog(page).getByText('XML dependencies:')).toBeVisible();
    await generate(page);
    expect((await lastConfig(api)).dataFormat).toBe('xml');
    expect(await shownCode(page)).toContain('Jane Doe');

    await dialog(page).getByRole('button', { name: '← Back to Config' }).click();
    await page.locator('#data-format-json').check();
    await expect(dialog(page).getByText('XML dependencies:')).toHaveCount(0);
    await generate(page);
    expect((await lastConfig(api)).dataFormat).toBe('json');
    await dialog(page).getByRole('button', { name: '← Back to Config' }).click();
    await dialog(page).getByRole('button', { name: /Use detected \(XML/ }).click();
    await expect(page.locator('#data-format-xml')).toBeChecked();
  });

  test('[CG-14] an XML request\'s pom.xml includes JAXB for Java 11+, as the dialog promises (BUG-E2E-08)', async ({ page }) => {
    test.fail(true, 'BUG-E2E-08: the dialog says JAXB "is included automatically" for Java 11/17/21, but the generated POM has no JAXB dependency');
    await parseToEditor(page, XML_PUT);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await advanced(page).click();
    await dialog(page).getByRole('checkbox', { name: 'Generate pom.xml' }).click();
    await generate(page);
    await tab(page, 'pom.xml').click();
    expect((await shownCode(page)).toLowerCase()).toContain('jaxb');
  });
});

test.describe('Code generation: secrets, downloads, lifecycle', () => {
  test('[CG-15][CG-16] Copy redacted / Copy with secrets; downloads hold the real values unless redaction is ticked', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await parseToEditor(page, CHROME_BASH);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await generate(page);
    expect(await shownCode(page)).not.toContain(SECRETS.bearer);

    await dialog(page).getByRole('button', { name: 'Copy redacted' }).click();
    await expect(dialog(page).getByRole('button', { name: 'Copied' })).toBeVisible();
    const redacted = await clipboard(page);
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain(SECRETS.bearer);
    expect(redacted).not.toContain(SECRETS.cookie);
    expect(redacted).toContain('.post("/v2/orders")');

    await dialog(page).getByRole('button', { name: 'Copy with secrets' }).click();
    const raw = await clipboard(page);
    expect(raw).toContain(SECRETS.bearer);
    expect(raw).toContain(SECRETS.cookie);

    const redactDownloads = dialog(page).getByRole('checkbox', { name: 'Redact secrets in downloaded files' });
    await expect(redactDownloads).not.toBeChecked();
    const plain = await downloadActive(page);
    expect(plain.text).toContain(SECRETS.bearer);
    await redactDownloads.click();
    const safe = await downloadActive(page);
    expect(safe.name).toBe(plain.name);
    expect(safe.text).not.toContain(SECRETS.bearer);
    expect(safe.text).not.toContain(SECRETS.cookie);
    expect(safe.text).toContain('[REDACTED]');
  });

  test('[CG-17] Esc keeps the result; editing the request drops it, keeping the configuration', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await page.locator('#class-name').fill('KeptName');
    await generate(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Generate Code', exact: true }).click();
    await expect(dialog(page).getByText('Generated Code', { exact: true })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Delete active', exact: true }).click();
    await openCodegen(page); // back on the config step
    await expect(page.locator('#class-name')).toHaveValue('KeptName');
    await generate(page);
    await api.settle();
    expect(api.of('/api/generate-from-parsed')).toHaveLength(2);
    expect(await shownCode(page)).not.toContain('.active(');
  });

  test('[CG-19] Cancel on the config step closes without generating', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await api.settle();
    expect(api.of('/api/generate-from-parsed')).toHaveLength(0);
  });
});
