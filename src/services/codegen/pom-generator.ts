/**
 * POM XML Generator Service
 * Generates Maven pom.xml with required dependencies based on code configuration
 */

import { CodeConfig, ParsedCurlData } from '@/constants/code-generation';

// ============================================================================
// DEPENDENCY TEMPLATES
// ============================================================================

const DEPENDENCY_VERSIONS = {
  REST_ASSURED: '5.3.2',
  TESTNG: '7.8.0',
  LOMBOK: '1.18.30',
  JACKSON: '2.15.3',
  JSON_PATH: '5.3.2',
  MAVEN_COMPILER_SOURCE: '11',
  MAVEN_COMPILER_TARGET: '11',
  SUREFIRE_PLUGIN: '3.0.0',
} as const;

const DEPENDENCIES = {
  REST_ASSURED: {
    groupId: 'io.rest-assured',
    artifactId: 'rest-assured',
    version: DEPENDENCY_VERSIONS.REST_ASSURED,
    scope: 'test',
    comment: 'REST Assured',
  },
  TESTNG: {
    groupId: 'org.testng',
    artifactId: 'testng',
    version: DEPENDENCY_VERSIONS.TESTNG,
    scope: 'test',
    comment: 'TestNG',
  },
  LOMBOK: {
    groupId: 'org.projectlombok',
    artifactId: 'lombok',
    version: DEPENDENCY_VERSIONS.LOMBOK,
    scope: 'provided',
    comment: 'Lombok (for POJO @Data, @Builder)',
  },
  JACKSON: {
    groupId: 'com.fasterxml.jackson.core',
    artifactId: 'jackson-databind',
    version: DEPENDENCY_VERSIONS.JACKSON,
    scope: undefined,
    comment: 'Jackson (for JSON serialization)',
  },
  JSON_PATH: {
    groupId: 'io.rest-assured',
    artifactId: 'json-path',
    version: DEPENDENCY_VERSIONS.JSON_PATH,
    scope: 'test',
    comment: 'JSON Path (for response parsing)',
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface Dependency {
  groupId: string;
  artifactId: string;
  version: string;
  scope?: string;
  comment: string;
}

interface PomConfig {
  groupId?: string;
  artifactId?: string;
  version?: string;
}

// ============================================================================
// POM GENERATOR CLASS
// ============================================================================

export class PomGenerator {
  /**
   * Main entry point - generates complete pom.xml
   */
  static generate(
    config: CodeConfig,
    parsedData: ParsedCurlData,
    pomConfig?: PomConfig
  ): string {
    const dependencies = this.selectDependencies(config, parsedData);
    return this.buildPomXml(dependencies, pomConfig);
  }

  /**
   * Determines which dependencies are needed based on configuration
   */
  private static selectDependencies(
    config: CodeConfig,
    parsedData: ParsedCurlData
  ): Dependency[] {
    const required: Dependency[] = [];

    // Base dependencies - always required
    required.push(DEPENDENCIES.REST_ASSURED);
    required.push(DEPENDENCIES.TESTNG);

    // POJO dependencies
    if (config.needPojo) {
      required.push(DEPENDENCIES.LOMBOK);
      required.push(DEPENDENCIES.JACKSON);
    }

    // JSON parsing dependency
    if (parsedData.data) {
      required.push(DEPENDENCIES.JSON_PATH);
    }

    return required;
  }

  /**
   * Formats a single dependency as XML
   */
  private static formatDependency(dep: Dependency): string {
    const lines = [
      `        <!-- ${dep.comment} -->`,
      '        <dependency>',
      `            <groupId>${dep.groupId}</groupId>`,
      `            <artifactId>${dep.artifactId}</artifactId>`,
      `            <version>${dep.version}</version>`,
    ];

    if (dep.scope) {
      lines.push(`            <scope>${dep.scope}</scope>`);
    }

    lines.push('        </dependency>');

    return lines.join('\n');
  }

  /**
   * Builds the complete pom.xml structure
   */
  private static buildPomXml(
    dependencies: Dependency[],
    pomConfig?: PomConfig
  ): string {
    const dependenciesXml = dependencies
      .map(dep => this.formatDependency(dep))
      .join('\n\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${pomConfig?.groupId || 'com.example'}</groupId>
    <artifactId>${pomConfig?.artifactId || 'api-tests'}</artifactId>
    <version>${pomConfig?.version || '1.0-SNAPSHOT'}</version>

    <properties>
        <maven.compiler.source>${DEPENDENCY_VERSIONS.MAVEN_COMPILER_SOURCE}</maven.compiler.source>
        <maven.compiler.target>${DEPENDENCY_VERSIONS.MAVEN_COMPILER_TARGET}</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
${dependenciesXml}
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>${DEPENDENCY_VERSIONS.SUREFIRE_PLUGIN}</version>
                <configuration>
                    <suiteXmlFiles>
                        <suiteXmlFile>testng.xml</suiteXmlFile>
                    </suiteXmlFiles>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
  }

  /**
   * Returns list of dependency versions for display purposes
   */
  static getDependencyVersions(): Record<string, string> {
    return { ...DEPENDENCY_VERSIONS };
  }

  /**
   * Validates if a dependency configuration is complete
   */
  static validateDependency(dep: Partial<Dependency>): dep is Dependency {
    return !!(
      dep.groupId &&
      dep.artifactId &&
      dep.version &&
      dep.comment
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if parsedData contains JSON payload
 */
export function hasJsonData(parsedData: ParsedCurlData): boolean {
  return !!(
    parsedData.data &&
    (typeof parsedData.data === 'object' || typeof parsedData.data === 'string')
  );
}

/**
 * Estimates the number of dependencies needed
 */
export function estimateDependencyCount(
  config: CodeConfig,
  parsedData: ParsedCurlData
): number {
  let count = 2; // Base: REST Assured + TestNG

  if (config.needPojo) {
    count += 2; // Lombok + Jackson
  }

  if (hasJsonData(parsedData)) {
    count += 1; // JSON Path
  }

  return count;
}