"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { Info, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import Loading from "../Loading";
import { useState, useEffect } from "react";
import { toast } from "../ui/use-toast";
import { Resume } from "@/models/profile.model";
import { AiModel, defaultModel } from "@/models/ai.model";
import { AiResumeReviewResponseContent } from "./AiResumeReviewResponseContent";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { ResumeReviewSchema } from "@/models/ai.schemas";
import { getUserSettings } from "@/actions/userSettings.actions";
import { useSlowResponseWarning } from "@/hooks/useSlowResponseWarning";
import { SlowResponseWarning } from "../common/SlowResponseWarning";

interface AiSectionProps {
  resume: Resume;
}

const AiResumeReviewSection = ({ resume }: AiSectionProps) => {
  const [aISectionOpen, setAiSectionOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AiModel>(defaultModel);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await getUserSettings();
        if (result.success && result.data?.settings?.ai) {
          const aiSettings = result.data.settings.ai;
          setSelectedModel({
            provider: aiSettings.provider || defaultModel.provider,
            model: aiSettings.model,
          });
        }
      } catch (error) {
        console.error("Error fetching AI settings:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  // Standard single-agent mode
  const { object, submit, isLoading, stop } = useObject({
    api: "/api/ai/resume/review",
    schema: ResumeReviewSchema,
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err.message || "Failed to get AI review",
      });
    },
  });

  const getResumeReview = () => {
    if (!resume || resume.ResumeSections?.length === 0) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Resume content is required",
      });
      return;
    }

    submit({ selectedModel, resume });
  };

  const triggerSheetChange = async (openState: boolean) => {
    setAiSectionOpen(openState);
    if (!openState && isLoading) {
      stop();
    }
  };

  // Check if we have any content to show
  const hasContent = object && (object.scores?.overall !== undefined || object.summary);

  const showSlowWarning = useSlowResponseWarning(isLoading, !!hasContent);

  return (
    <Sheet open={aISectionOpen} onOpenChange={triggerSheetChange}>
      <div className="ml-2">
        <SheetTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 cursor-pointer"
            onClick={() => triggerSheetChange(true)}
            disabled={isLoading || isLoadingSettings || resume.ResumeSections?.length! < 2}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Review
            </span>
          </Button>
        </SheetTrigger>
      </div>
      <SheetPortal>
        <SheetContent className="overflow-y-scroll">
          <SheetHeader>
            <SheetTitle className="flex flex-row items-center">
              AI Review ({selectedModel.provider})
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground mx-1" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{`Provider: ${selectedModel.provider}`}</p>
                    <p>{`Model: ${selectedModel.model}`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 cursor-pointer"
              onClick={getResumeReview}
              disabled={isLoading}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Generate AI Review
              </span>
            </Button>
          </div>

          {isLoading && !hasContent ? (
            <div className="flex items-center flex-col mt-4">
              <Loading />
              <div className="mt-2">Analyzing resume...</div>
              {showSlowWarning && <SlowResponseWarning />}
            </div>
          ) : (
            <AiResumeReviewResponseContent
              content={object}
              isStreaming={isLoading}
            />
          )}
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
};

export default AiResumeReviewSection;
