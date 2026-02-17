import Dockerode from "dockerode";

/**
 * Docker utilities for container management
 */
export class DockerUtils {
  private docker: Dockerode;

  constructor() {
    this.docker = new Dockerode();
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all containers
   */
  async listContainers(all: boolean = false): Promise<Dockerode.ContainerInfo[]> {
    return await this.docker.listContainers({ all });
  }

  /**
   * Get container by name
   */
  async getContainerByName(name: string): Promise<Dockerode.Container | null> {
    const containers = await this.listContainers(true);
    const containerInfo = containers.find(
      (c) => c.Names.includes(`/${name}`) || c.Names.includes(name)
    );

    if (!containerInfo) {
      return null;
    }

    return this.docker.getContainer(containerInfo.Id);
  }

  /**
   * Check if container exists
   */
  async containerExists(name: string): Promise<boolean> {
    const container = await this.getContainerByName(name);
    return container !== null;
  }

  /**
   * Check if container is running
   */
  async isContainerRunning(name: string): Promise<boolean> {
    const container = await this.getContainerByName(name);

    if (!container) {
      return false;
    }

    const info = await container.inspect();
    return info.State.Running;
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    name: string,
    tail: number = 100
  ): Promise<string | null> {
    const container = await this.getContainerByName(name);

    if (!container) {
      return null;
    }

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
    });

    return logs.toString();
  }

  /**
   * Get container stats
   */
  async getContainerStats(
    name: string
  ): Promise<Dockerode.ContainerStats | null> {
    const container = await this.getContainerByName(name);

    if (!container) {
      return null;
    }

    return new Promise((resolve, reject) => {
      container.stats({ stream: false }, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats as Dockerode.ContainerStats);
        }
      });
    });
  }

  /**
   * Remove container
   */
  async removeContainer(name: string, force: boolean = false): Promise<boolean> {
    const container = await this.getContainerByName(name);

    if (!container) {
      return false;
    }

    try {
      await container.remove({ force });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Prune unused containers
   */
  async pruneContainers(): Promise<Dockerode.PruneContainersInfo> {
    return await this.docker.pruneContainers();
  }

  /**
   * List images
   */
  async listImages(): Promise<Dockerode.ImageInfo[]> {
    return await this.docker.listImages();
  }

  /**
   * Remove image
   */
  async removeImage(name: string, force: boolean = false): Promise<boolean> {
    try {
      const image = this.docker.getImage(name);
      await image.remove({ force });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker system info
   */
  async getSystemInfo(): Promise<Dockerode.DockerVersion> {
    return await this.docker.version();
  }
}
