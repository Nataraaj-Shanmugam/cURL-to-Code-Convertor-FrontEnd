import { http, HttpResponse } from 'msw';

// Sample parsed cURL response from the backend
export const mockParsedCurl = {
  method: 'POST',
  url: 'https://api.example.com/users',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.token',
  },
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    address: {
      city: 'New York',
      zip: '10001',
    },
  },
  query_params: {
    page: '1',
    limit: '10',
  },
  cookies: {
    session_id: 'abc123',
  },
};

// Sample code generation response
export const mockGeneratedCode = `import io.restassured.RestAssured;
import io.restassured.response.Response;
import static io.restassured.RestAssured.*;
import org.testng.annotations.*;

public class ApiTest {
    @BeforeClass
    public void setup() {
        RestAssured.baseURI = "https://api.example.com";
    }

    @Test
    public void testApiRequest() {
        Response response = given()
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.token")
            .body("{\\"name\\": \\"John Doe\\", \\"email\\": \\"john@example.com\\"}")
        .when()
            .post("/users")
        .then()
            .statusCode(200)
            .extract().response();
    }
}`;

export const handlers = [
  // Health check endpoint
  http.get('*/api/health', () => {
    return HttpResponse.json({ status: 'ok', version: '2.0.0' });
  }),

  // Parse cURL endpoint
  http.post('*/api/parse', async ({ request }) => {
    const body = await request.json() as { curl?: string };
    const curlStr = body?.curl || '';

    // Simulate validation error for empty curl
    if (!curlStr.trim()) {
      return HttpResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'cURL command is required' },
      }, { status: 400 });
    }

    // Simulate invalid curl
    if (curlStr.includes('invalid-curl-garbage')) {
      return HttpResponse.json({
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Invalid cURL command format' },
      }, { status: 422 });
    }

    // Return parsed result
    return HttpResponse.json({
      success: true,
      data: mockParsedCurl,
    });
  }),

  // Generate code endpoint
  http.post('*/api/generate-from-parsed', async ({ request }) => {
    const body = await request.json() as { parsed_data?: any; config?: any };
    const config = body?.config;

    if (!config?.option) {
      return HttpResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Generation option is required' },
      }, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
      generated_code: mockGeneratedCode,
      complete_code: mockGeneratedCode,
      pojo_code: config.needPojo
        ? `import lombok.Data;\nimport lombok.Builder;\n\n@Data\n@Builder\npublic class RequestBody {\n    private String name;\n    private String email;\n}`
        : '',
      warnings: [],
      language: 'java',
    });
  }),

  // Body edit endpoint
  http.post('*/api/body/edit', async ({ request }) => {
    const body = await request.json() as { body?: any; path?: string; value?: any };
    if (!body?.path) {
      return HttpResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Path is required' },
      }, { status: 400 });
    }
    return HttpResponse.json({ success: true });
  }),

  // Body delete endpoint
  http.post('*/api/body/delete', async ({ request }) => {
    const body = await request.json() as { body?: any; path?: string };
    if (!body?.path) {
      return HttpResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Path is required' },
      }, { status: 400 });
    }
    return HttpResponse.json({ success: true });
  }),

  // Feedback endpoint
  http.post('*/api/feedback', () => {
    return HttpResponse.json({ success: true });
  }),
];
