// src/lib/generateRestAssured.ts
import type { ParsedData, TestConfig } from '../types';

interface GenerateCodeConfig extends ParsedData, TestConfig {
  body?: string;
}

export const generateRestAssuredCode = (config: GenerateCodeConfig): string => {
  const { method, url, headers = [], queryParams = [], body, auth = [], className, methodName, framework } = config;

  let code = '';

  // Imports
  code += 'import io.restassured.RestAssured;\n';
  code += 'import io.restassured.response.Response;\n';
  code += 'import static io.restassured.RestAssured.given;\n';
  code += 'import static org.hamcrest.Matchers.*;\n';

  if (framework === 'junit') {
    code += 'import org.junit.Test;\n';
  } else {
    code += 'import org.testng.annotations.Test;\n';
  }

  code += '\n';

  // Class declaration
  code += `public class ${className} {\n\n`;

  // Test method
  code += '    @Test\n';
  code += `    public void ${methodName}() {\n`;

  // Build request
  code += '        Response response = given()\n';

  // Add headers
  const enabledHeaders = headers.filter(h => h.enabled && h.key && h.value);
  if (enabledHeaders.length > 0) {
    enabledHeaders.forEach(header => {
      code += `                .header("${header.key}", "${header.value}")\n`;
    });
  }

  // Add auth
  const enabledAuth = auth.filter(a => a.enabled && a.key && a.value);
  if (enabledAuth.length > 0) {
    enabledAuth.forEach(authItem => {
      if (authItem.key.toLowerCase() === 'authorization' && authItem.value.startsWith('Bearer ')) {
        const token = authItem.value.replace('Bearer ', '');
        code += `                .auth().oauth2("${token}")\n`;
      } else {
        code += `                .header("${authItem.key}", "${authItem.value}")\n`;
      }
    });
  }

  // Add query parameters
  const enabledParams = queryParams.filter(p => p.enabled && p.key && p.value);
  if (enabledParams.length > 0) {
    enabledParams.forEach(param => {
      code += `                .queryParam("${param.key}", "${param.value}")\n`;
    });
  }

  // Add body
  if (body && body.trim()) {
    code += `                .body("${body.replace(/"/g, '\\"')}")\n`;
  }

  // Make request
  code += '            .when()\n';
  code += `                .${method.toLowerCase()}("${url}")\n`;
  code += '            .then()\n';
  code += '                .statusCode(200)\n';
  code += '                .log().all();\n';

  // Optional assertions
  code += '\n        // Add your assertions here\n';
  code += '        // response.then().body("key", equalTo("expectedValue"));\n';

  code += '    }\n';
  code += '}\n';

  return code;
};