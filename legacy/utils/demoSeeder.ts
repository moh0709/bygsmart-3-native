/**
 * Demo data seeder — seeds a complete demo project for new demo users.
 * Called from LoginPage after a successful demo login.
 * Swallows errors so seeding failure never blocks the user from entering the app.
 */

import { DEMO_PROJECT } from '../data/demoSeed.data';
import { getProjects, createProjectWithPlan } from '../modules/projects';
import {
    getLayoutsForProject,
    createLayout,
    getPunchListForProject,
    createPunchListItem,
} from '../modules/quality';
import { createReminderForProject } from '../modules/planning';
import type { PunchListLayout, PunchListItemStatus } from '../types';

async function seedDemoPunchList(projectId: string): Promise<void> {
    const layoutsByTitle = new Map<string, PunchListLayout>();
    const existingLayouts = await getLayoutsForProject(projectId);
    existingLayouts.forEach((layout) => layoutsByTitle.set(layout.title, layout));

    if (DEMO_PROJECT.punchListLayouts) {
        for (const layout of DEMO_PROJECT.punchListLayouts) {
            if (layoutsByTitle.has(layout.title)) continue;

            const createdLayout = await createLayout(projectId, layout);
            layoutsByTitle.set(layout.title, createdLayout);
        }
    }

    const existingItems = await getPunchListForProject(projectId);
    const existingDescriptions = new Set(existingItems.map((item) => item.description));

    if (DEMO_PROJECT.punchListItems) {
        for (const item of DEMO_PROJECT.punchListItems) {
            if (existingDescriptions.has(item.description)) continue;

            const layout = layoutsByTitle.get(item.layoutTitle);
            if (!layout) continue;

            await createPunchListItem(projectId, {
                layoutId: layout.id,
                description: item.description,
                status: item.status as PunchListItemStatus,
                pin: item.pin,
                photoUrl: item.photoUrl || '',
                resolutionDueDate: item.resolutionDueDate,
            });
        }
    }
}

/**
 * Seeds demo data for the given user if they have no projects yet.
 * @param userId - The authenticated user's ID.
 */
export async function seedDemoDataIfNeeded(userId: string): Promise<void> {
    try {
        // Check if user already has projects (already seeded)
        const existingProjects = await getProjects(userId);
        if (existingProjects.length > 0) {
            await seedDemoPunchList(existingProjects[0].id);
            return;
        }

        // Create the project with all tasks and purchases atomically
        const project = await createProjectWithPlan(
            DEMO_PROJECT.project.name,
            DEMO_PROJECT.project.description,
            DEMO_PROJECT.tasks,
            DEMO_PROJECT.purchases,
            [], // team — seed data members don't exist in auth
            DEMO_PROJECT.project.startDate,
            DEMO_PROJECT.project.endDate,
            userId,
            {
                clientName: DEMO_PROJECT.project.clientName,
                address: DEMO_PROJECT.project.address,
                budget: DEMO_PROJECT.project.budget,
            }
        );

        // Seed reminders
        if (DEMO_PROJECT.reminders) {
            for (const reminder of DEMO_PROJECT.reminders) {
                await createReminderForProject(project.id, {
                    title: reminder.title,
                    dateTime: reminder.dateTime,
                    context: reminder.context,
                });
            }
        }

        await seedDemoPunchList(project.id);
    } catch (err) {
        console.error('[DemoSeeder] Failed to seed demo data:', err);
        // Never throw — seeding failure must not block app entry
    }
}
