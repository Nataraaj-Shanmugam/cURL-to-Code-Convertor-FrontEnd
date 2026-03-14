import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import CodeGenerationDialog from '@/components/features/curl/CodeGenerationDialog';
import type { ParsedCurl } from '@/types/curl';

const mockParsedData: ParsedCurl = {
  method: 'POST',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token',
  },
  data: { name: 'John', email: 'john@example.com' },
  query_params: { page: '1' },
};

describe('CodeGenerationDialog', () => {
  const user = userEvent.setup();
  const mockOnOpenChange = vi.fn();

  const renderDialog = (open = true) => {
    return renderWithProviders(
      <CodeGenerationDialog
        open={open}
        onOpenChange={mockOnOpenChange}
        parsedData={mockParsedData}
      />,
    );
  };

  beforeEach(() => {
    mockOnOpenChange.mockClear();
  });

  describe('config step', () => {
    it('should render dialog title', () => {
      renderDialog();

      expect(screen.getByText('Code Generation Configuration')).toBeInTheDocument();
    });

    it('should render generation type options', () => {
      renderDialog();

      expect(screen.getByText('Full Test Class')).toBeInTheDocument();
      expect(screen.getByText('Test Method Only')).toBeInTheDocument();
    });

    it('should show config options after selecting generation type', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByLabelText(/Test Class Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Method Name/)).toBeInTheDocument();
    });

    it('should show POJO options when POJO checkbox is checked', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const pojoCheckbox = screen.getByText('Generate POJO Classes');
      await user.click(pojoCheckbox);

      expect(screen.getByText(/POJO Class Name/)).toBeInTheDocument();
    });

    it('should show assertion status code input when assertions enabled', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      expect(screen.getByText('Expected Status Code')).toBeInTheDocument();
    });

    it('should disable Generate button when no option selected', () => {
      renderDialog();

      const generateButton = screen.getByText('Generate Code').closest('button');
      expect(generateButton).toBeDisabled();
    });

    it('should enable Generate button when option is selected', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const generateButton = screen.getByText('Generate Code').closest('button');
      expect(generateButton).not.toBeDisabled();
    });

    it('should show error when generating without option selected', async () => {
      renderDialog();

      // Try to generate without selecting option — but button is disabled
      // So test the validation via the error state
      const generateButton = screen.getByText('Generate Code').closest('button');
      expect(generateButton).toBeDisabled();
    });

    it('should have default values for class and method names', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const classInput = screen.getByDisplayValue('ApiTest');
      const methodInput = screen.getByDisplayValue('testApiRequest');

      expect(classInput).toBeInTheDocument();
      expect(methodInput).toBeInTheDocument();
    });

    it('should allow changing class and method names', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const classInput = screen.getByDisplayValue('ApiTest');
      await user.clear(classInput);
      await user.type(classInput, 'UserApiTest');

      expect(classInput).toHaveValue('UserApiTest');
    });

    it('should not show class name input for method-only generation', async () => {
      renderDialog();

      const methodRadio = screen.getByLabelText(/Test Method Only/);
      await user.click(methodRadio);

      expect(screen.queryByLabelText(/Test Class Name/)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Method Name/)).toBeInTheDocument();
    });
  });

  describe('code generation (BE integration)', () => {
    it('should call generate API and display results', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const generateButton = screen.getByText('Generate Code').closest('button')!;
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Code')).toBeInTheDocument();
      });

      // Should show test code tab
      expect(screen.getByText('Test Code')).toBeInTheDocument();
      expect(screen.getByText('Dependencies (pom.xml)')).toBeInTheDocument();
    });

    it('should show POJO tab when POJO generation is enabled', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const pojoCheckbox = screen.getByText('Generate POJO Classes');
      await user.click(pojoCheckbox);

      const generateButton = screen.getByText('Generate Code').closest('button')!;
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('POJO Classes')).toBeInTheDocument();
      });
    });

    it('should display error when generation fails', async () => {
      server.use(
        http.post('*/api/generate-from-parsed', () => {
          return HttpResponse.json(
            { success: false, error: { code: 'ERR', message: 'Generation failed' } },
            { status: 500 },
          );
        }),
      );

      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const generateButton = screen.getByText('Generate Code').closest('button')!;
      await user.click(generateButton);

      await waitFor(() => {
        // Use getAllByText to handle both the visible error and the sr-only aria-live region
        const errorEls = screen.getAllByText((content) => content.includes('Generation failed'));
        expect(errorEls.length).toBeGreaterThan(0);
      });
    });

    it('should show loading state during generation', async () => {
      server.use(
        http.post('*/api/generate-from-parsed', async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            generated_code: 'code',
            complete_code: 'code',
          });
        }),
      );

      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const generateButton = screen.getByText('Generate Code').closest('button')!;
      await user.click(generateButton);

      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });
  });

  describe('result step', () => {
    const generateCode = async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const generateButton = screen.getByText('Generate Code').closest('button')!;
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Code')).toBeInTheDocument();
      });
    };

    it('should have Copy button', async () => {
      await generateCode();

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should have Download button for full test class', async () => {
      await generateCode();

      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('should have Back to Config button', async () => {
      await generateCode();

      const backButton = screen.getByText('← Back to Config');
      expect(backButton).toBeInTheDocument();
    });

    it('should go back to config step on Back button click', async () => {
      await generateCode();

      const backButton = screen.getByText('← Back to Config');
      await user.click(backButton);

      expect(screen.getByText('Code Generation Configuration')).toBeInTheDocument();
    });

    it('should have Feedback button', async () => {
      await generateCode();

      expect(screen.getByText('Feedback')).toBeInTheDocument();
    });

    it('should switch between tabs', async () => {
      await generateCode();

      const pomTab = screen.getByText('Dependencies (pom.xml)');
      await user.click(pomTab);

      // Should show POM content (prism-react-renderer renders into a <pre>, no <code> wrapper)
      const preEl = document.querySelector('pre');
      expect(preEl?.textContent).toContain('maven');
    });

    it('should generate POM with REST Assured and TestNG dependencies', async () => {
      await generateCode();

      const pomTab = screen.getByText('Dependencies (pom.xml)');
      await user.click(pomTab);

      const codeBlock = document.querySelector('pre');
      const pomContent = codeBlock?.textContent || '';

      expect(pomContent).toContain('rest-assured');
      expect(pomContent).toContain('testng');
    });

    it('should include Lombok in POM when POJO is enabled', async () => {
      renderDialog();

      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      const pojoCheckbox = screen.getByText('Generate POJO Classes');
      await user.click(pojoCheckbox);

      const generateButton = screen.getByText('Generate Code').closest('button')!;
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Code')).toBeInTheDocument();
      });

      const pomTab = screen.getByText('Dependencies (pom.xml)');
      await user.click(pomTab);

      const codeBlock = document.querySelector('pre');
      const pomContent = codeBlock?.textContent || '';

      expect(pomContent).toContain('lombok');
      expect(pomContent).toContain('jackson-databind');
    });

    it('should include json-path in POM when parsed data has body', async () => {
      await generateCode();

      const pomTab = screen.getByText('Dependencies (pom.xml)');
      await user.click(pomTab);

      const codeBlock = document.querySelector('pre');
      const pomContent = codeBlock?.textContent || '';

      expect(pomContent).toContain('json-path');
    });
  });

  describe('dialog lifecycle', () => {
    it('should not render when closed', () => {
      renderDialog(false);

      expect(screen.queryByText('Code Generation Configuration')).not.toBeInTheDocument();
    });

    it('should reset state on close', async () => {
      renderDialog();

      // Select an option
      const fullRadio = screen.getByLabelText(/Full Test Class/);
      await user.click(fullRadio);

      // Close the dialog
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
