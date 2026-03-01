import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { userRepository } from "../repositories/userRepository";
import { provisioningRepository } from "../repositories/provisioningRepository";
import {
  ConfigGenerationService,
  type OnboardingData,
} from "../provisioning/configGenerationService";

export const userHandler = new Elysia({ name: "UserHandler" })
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/users/me",
    async (ctx) => {
      const { set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        return {
          success: true,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            fullName: dbUser.fullName,
            onboardingCompleted: dbUser.onboardingCompleted,
            createdAt: dbUser.createdAt,
            updatedAt: dbUser.updatedAt,
          },
        };
      } catch (error) {
        console.error("Get user error:", error);
        set.status = 500;
        return { success: false, error: "Failed to fetch user profile" };
      }
    },
    {
      detail: {
        description: "Get current user profile",
        tags: ["Users"],
      },
    },
  )
  .get(
    "/users/gateway-token",
    async (ctx) => {
      const { set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        const provisioningState = await provisioningRepository.findByUserId(
          dbUser.id,
        );
        if (!provisioningState || !provisioningState.gatewayToken) {
          set.status = 404;
          return {
            success: false,
            error: "Gateway token not found. Complete onboarding first.",
          };
        }

        return {
          success: true,
          gatewayToken: provisioningState.gatewayToken,
        };
      } catch (error) {
        console.error("Get gateway token error:", error);
        set.status = 500;
        return {
          success: false,
          error: "Failed to fetch gateway token",
        };
      }
    },
    {
      detail: {
        description: "Get OpenClaw gateway token for WebSocket connection",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/users/onboarding",
    async (ctx) => {
      const { body, set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        // Store onboarding answers
        await userRepository.updateOnboardingAnswers(dbUser.id, body);

        // Generate gateway token
        const gatewayToken = ConfigGenerationService.generateGatewayToken();

        // Generate config files from answers
        const onboardingData: OnboardingData = {
          name: body.name,
          role: body.role || "Professional",
          goals: body.goals || "",
          helpWith:
            typeof body.helpWith === "string"
              ? body.helpWith
              : body.helpWith?.join(", ") || "",
          painPoints: body.painPoints || "",
          knowledgeAreas: body.knowledgeAreas || "",
        };

        const generatedFiles = ConfigGenerationService.generateConfigFiles(
          onboardingData,
          gatewayToken,
        );

        // Write files to disk
        let workspacePath = undefined;
        try {
          workspacePath = await ConfigGenerationService.writeFilesToDisk(
            dbUser.id,
            generatedFiles,
          );
        } catch (diskError) {
          console.warn(
            "Failed to write files to disk:",
            diskError instanceof Error ? diskError.message : String(diskError),
          );
          // Continue anyway — files are stored in DB
        }

        // Store generated files in database
        for (const [fileName, content] of Object.entries(generatedFiles)) {
          await userRepository.storeProvisioningFile(
            dbUser.id,
            fileName,
            content,
          );
        }

        // Update provisioning state
        let provisioningState = await provisioningRepository.findByUserId(
          dbUser.id,
        );
        if (!provisioningState) {
          provisioningState = await provisioningRepository.create({
            userId: dbUser.id,
            status: "config_generated",
            workspacePath,
          });
        } else {
          await provisioningRepository.updateStatus(
            provisioningState.id,
            "config_generated",
          );
          if (workspacePath) {
            // Store workspace path if we got one
            await provisioningRepository.updateProvisioned(
              provisioningState.id,
              workspacePath,
            );
          }
        }

        // Store the gateway token
        await provisioningRepository.updateGatewayToken(
          provisioningState.id,
          gatewayToken,
        );

        // Update user to mark onboarding as completed
        await userRepository.updateUser(dbUser.id, {
          onboardingCompleted: true,
        });

        return { success: true, userId: dbUser.id };
      } catch (error) {
        console.error("Onboarding error:", error);
        set.status = 500;
        return { success: false, error: "Failed to complete onboarding" };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        role: t.Optional(t.String()),
        goals: t.Optional(t.String()),
        helpWith: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        painPoints: t.Optional(t.String()),
        knowledgeAreas: t.Optional(t.String()),
      }),
      detail: {
        description: "Complete user onboarding with config generation",
        tags: ["Users"],
      },
    },
  );
