"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface ParsedResultCardProps {
  parsed: any;
}

// JSON pretty-print
const JsonBlock = ({ data }: { data: any }) => (
  <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-3 rounded-md overflow-auto max-h-96">
    {JSON.stringify(data, null, 2)}
  </pre>
);

// Simple info row
const InfoRow = ({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: any;
  valueClassName?: string;
}) => (
  <div className="flex flex-col sm:flex-row gap-2">
    <span className="font-semibold min-w-[150px]">{label}:</span>
    <span className={`break-all ${valueClassName}`}>{value ?? "N/A"}</span>
  </div>
);

export const ParsedResultCard: React.FC<ParsedResultCardProps> = ({ parsed }) => {
  if (!parsed) return null;

  const {
    method,
    base_url,
    endpoint,
    path_template,
    path_parameters,
    query_params,
    headers,
    data,
    raw_data,
    form_data,
    cookies,
    auth,
    proxy,
    user_agent,
    referer,
    network_config,
    ssl_config,
    flags,
    all_options,
    meta,
  } = parsed;

  const hasValues = (obj: any) => obj && Object.keys(obj).length > 0;
  const hasActiveFlags = (flagsObj: any) =>
    flagsObj && Object.values(flagsObj).some((val) => val === true);

  const parseBody = (body: any) => {
    if (typeof body !== "string") return <JsonBlock data={body} />;
    try {
      return <JsonBlock data={JSON.parse(body)} />;
    } catch {
      return (
        <p className="font-mono text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
          {body}
        </p>
      );
    }
  };

  return (
    <Card className="shadow-md border border-border">
      <CardHeader>
        <CardTitle className="text-primary text-lg">Parsed Request Details</CardTitle>
      </CardHeader>

      <CardContent>
        <Accordion type="multiple" className="space-y-3">

          {/* 🔹 Request Overview */}
          <AccordionItem value="request">
            <AccordionTrigger>Request Details</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <InfoRow
                  label="Method"
                  value={method?.toUpperCase() || "GET"}
                  valueClassName="font-bold text-green-600"
                />
                <InfoRow label="Base URL" value={base_url} />
                <InfoRow label="Endpoint" value={endpoint} />
                <InfoRow label="Path Template" value={path_template} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 🔹 Path Parameters */}
          {Array.isArray(path_parameters) && path_parameters.length > 0 && (
            <AccordionItem value="path">
              <AccordionTrigger>Path Parameters</AccordionTrigger>
              <AccordionContent>
                <JsonBlock data={path_parameters} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Query Parameters */}
          {hasValues(query_params) && (
            <AccordionItem value="query">
              <AccordionTrigger>Query Parameters</AccordionTrigger>
              <AccordionContent>
                <JsonBlock data={query_params} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Headers */}
          {hasValues(headers) && (
            <AccordionItem value="headers">
              <AccordionTrigger>Headers</AccordionTrigger>
              <AccordionContent>
                <JsonBlock data={headers} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Request Body */}
          {data && (
            <AccordionItem value="body">
              <AccordionTrigger>Request Body</AccordionTrigger>
              <AccordionContent>{parseBody(data)}</AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Form Data */}
          {hasValues(form_data) && (
            <AccordionItem value="form">
              <AccordionTrigger>Form Data</AccordionTrigger>
              <AccordionContent>
                <JsonBlock data={form_data} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Cookies */}
          {hasValues(cookies) && (
            <AccordionItem value="cookies">
              <AccordionTrigger>Cookies</AccordionTrigger>
              <AccordionContent>
                <JsonBlock data={cookies} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Authentication */}
          {auth && (
            <AccordionItem value="auth">
              <AccordionTrigger>Authentication</AccordionTrigger>
              <AccordionContent>
                <p className="font-mono text-sm bg-muted p-3 rounded-md">
                  {typeof auth === "string" ? auth : JSON.stringify(auth, null, 2)}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Client Context */}
          {(user_agent || referer || proxy) && (
            <AccordionItem value="context">
              <AccordionTrigger>Client Context</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {user_agent && <InfoRow label="User Agent" value={user_agent} />}
                  {referer && <InfoRow label="Referer" value={referer} />}
                  {proxy && <InfoRow label="Proxy" value={proxy} />}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Network Configuration */}
          {hasValues(network_config) && (
            <AccordionItem value="network">
              <AccordionTrigger>Network Configuration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {Object.entries(network_config).map(([key, value]) => (
                    <InfoRow key={key} label={key} value={value} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 SSL/TLS Configuration */}
          {hasValues(ssl_config) && (
            <AccordionItem value="ssl">
              <AccordionTrigger>SSL/TLS Configuration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {Object.entries(ssl_config).map(([key, value]) => (
                    <InfoRow key={key} label={key} value={value} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Flags */}
          {hasActiveFlags(flags) && (
            <AccordionItem value="flags">
              <AccordionTrigger>Flags</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(flags)
                    .filter(([_, val]) => val === true)
                    .map(([key]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-mono">{key}</span>
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 🔹 Meta Information */}
          {meta && (
            <AccordionItem value="meta">
              <AccordionTrigger>Meta Information</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {Object.entries(meta).map(([key, value]) => (
                    <InfoRow key={key} label={key} value={value} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
};
