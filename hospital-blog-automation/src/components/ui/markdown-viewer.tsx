'use client';

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Printer,
  Copy,
  Check,
  FileText,
  FileImage,
  FileCode,
  ChevronDown,
} from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  title?: string;
  className?: string;
}

export function MarkdownViewer({ content, title, className }: MarkdownViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // 마크다운 복사
  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // HTML로 복사
  const handleCopyHtml = async () => {
    if (contentRef.current) {
      await navigator.clipboard.writeText(contentRef.current.innerHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // PNG 이미지로 다운로드
  const handleDownloadImage = async () => {
    if (contentRef.current) {
      try {
        const dataUrl = await toPng(contentRef.current, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
        });
        const link = document.createElement('a');
        link.download = `${title || 'blog-content'}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('이미지 생성 실패:', error);
      }
    }
  };

  // 마크다운 파일 다운로드
  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${title || 'blog-content'}.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // HTML 파일 다운로드
  const handleDownloadHtml = () => {
    if (contentRef.current) {
      const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Blog Content'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 2em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    ul, ol { padding-left: 2em; }
    li { margin: 0.5em 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 5px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 0.75em; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
${contentRef.current.innerHTML}
</body>
</html>`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${title || 'blog-content'}.html`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // 프린트
  const handlePrint = () => {
    if (contentRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${title || 'Blog Content'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 2em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    ul, ol { padding-left: 2em; }
    li { margin: 0.5em 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 5px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
${contentRef.current.innerHTML}
</body>
</html>`);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className={className}>
      {/* 툴바 */}
      <div className="flex items-center justify-end gap-2 mb-4 pb-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyMarkdown}
          className="gap-2"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? '복사됨' : '복사'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              다운로드
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadMarkdown}>
              <FileText className="h-4 w-4 mr-2" />
              마크다운 (.md)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadHtml}>
              <FileCode className="h-4 w-4 mr-2" />
              HTML (.html)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDownloadImage}>
              <FileImage className="h-4 w-4 mr-2" />
              이미지 (.png)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          프린트
        </Button>
      </div>

      {/* 마크다운 콘텐츠 */}
      <div
        ref={contentRef}
        className="prose prose-slate max-w-none
          prose-headings:font-semibold
          prose-h1:text-2xl prose-h1:border-b prose-h1:pb-3 prose-h1:mb-6
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-base prose-p:leading-relaxed prose-p:my-4
          prose-ul:my-4 prose-ol:my-4
          prose-li:my-1
          prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-blockquote:pr-4 prose-blockquote:py-3 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-gray-900 [&_blockquote_p]:text-gray-900 [&_blockquote]:text-gray-900
          prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-slate-100 prose-pre:rounded-lg
          prose-strong:font-semibold
          prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
          prose-hr:my-8
          prose-table:my-6
          prose-th:bg-slate-100 prose-th:px-4 prose-th:py-2
          prose-td:px-4 prose-td:py-2 prose-td:border
        "
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            blockquote: ({ children }) => (
              <blockquote
                style={{
                  borderLeft: '4px solid #3b82f6',
                  backgroundColor: '#eff6ff',
                  padding: '12px 16px',
                  margin: '16px 0',
                  borderRadius: '0 8px 8px 0',
                  color: '#111827',
                  fontStyle: 'normal',
                }}
              >
                <div style={{ color: '#111827' }}>{children}</div>
              </blockquote>
            ),
            p: ({ children, ...props }) => {
              // blockquote 내부의 p 태그는 부모에서 처리
              return <p style={{ color: 'inherit' }} {...props}>{children}</p>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
