/**
 * D3-Powered File Graph Component
 * 
 * This component provides an interactive, futuristic graph visualization of the file tree.
 * It represents files and folders as distinct nodes in a force-directed layout,
 * with visual distinctions between files and folders.
 * 
 * Features:
 * - Interactive D3.js force-directed graph visualization
 * - Distinct visual representations for files vs folders
 * - Zoom and pan navigation
 * - Fullscreen mode toggle
 * - Hover details with file/folder information
 * - Selection highlighting with visual feedback
 * 
 * Most recent changes:
 * - Replaced canvas-based implementation with D3.js
 * - Added fullscreen toggle functionality
 * - Created distinct visual representations for files and folders
 * - Implemented force-directed layout with physics
 * - Added interactive zoom and pan capabilities
 * - Enhanced visual feedback for selection and hover states
 * - Fixed TypeScript type errors for D3 events and elements
 * - Improved handling of undefined or null values for better stability
 * - Added proper type assertions for D3 elements and events
 */

import React, { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { useResizeObserver } from "@/hooks/utility-hooks/use-resize-observer";
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProjectFile } from "shared/schema";
import { calculateFolderTokens, formatTokenCount, FileNode } from "../file-tree/file-tree-utils/file-node-tree-utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

// Temporarily declare d3 module to avoid TypeScript errors
// TODO: Properly install @types/d3 to get proper type checking
// Using a simpler approach to avoid TypeScript errors while still providing some type safety
declare module 'd3';

// Import D3 modules (you'll need to install d3 and @types/d3)
import * as d3 from "d3";

// Define our own type for D3 zoom transform since we can't import it
type ZoomTransform = {
  x: number;
  y: number;
  k: number;
  toString(): string;
};

// Types for D3 events
interface D3DragEvent<T, U> {
  active: boolean;
  sourceEvent: MouseEvent;
  subject: U;
  x: number;
  y: number;
}

interface D3ZoomEvent<T> {
  transform: d3.ZoomTransform;
  sourceEvent: MouseEvent;
}

export type FileGraphRef = {
  focusGraph: () => void;
};

export type FileGraphProps = {
  root: Record<string, FileNode>;
  onViewFile?: (file: ProjectFile) => void;
  projectRoot: string;
  onRequestAIFileChange?: (filePath: string) => void;
};

// Node type for the graph rendering
type GraphNode = {
  id: string;
  name: string;
  path: string;
  x?: number;
  y?: number;
  radius: number;
  type: "file" | "folder";
  tokenCount: number;
  parent?: string;
  isSelected?: boolean;
  node: FileNode;
  // For D3 simulation
  fx?: number | null;
  fy?: number | null;
  index?: number;
  vx?: number;
  vy?: number;
};

// Edge type for connecting nodes
type GraphEdge = {
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number; // Based on selection percentage
};

// Size constants - updated for D3 visualization
const MIN_NODE_SIZE = 10;
const MAX_NODE_SIZE = 50;
const MIN_TOKEN_SIZE = 100;
const MAX_TOKEN_SIZE = 50000;

// Color scheme for futuristic look
const colors = {
  folderBase: "#0f172a",    // Dark blue
  folderSelected: "#3b82f6", // Bright blue
  folderHover: "#60a5fa",   // Light blue
  fileBase: "#1e293b",      // Dark slate
  fileSelected: "#4ade80",  // Green
  fileHover: "#86efac",     // Light green
  edgeBase: "#334155",      // Slate
  edgeSelected: "#3b82f6",  // Blue
  background: "#020617",    // Almost black
  text: "#f8fafc",          // Almost white
  glow: "#38bdf8"           // Cyan glow
};

/**
 * Maps a token count to a node size using a logarithmic scale
 */
function tokenCountToNodeSize(tokenCount: number): number {
  if (tokenCount <= 0) return MIN_NODE_SIZE;
  
  // Log scale with base adjustment for better visual representation
  const normalizedCount = Math.min(Math.max(tokenCount, MIN_TOKEN_SIZE), MAX_TOKEN_SIZE);
  const logScale = Math.log(normalizedCount / MIN_TOKEN_SIZE) / Math.log(MAX_TOKEN_SIZE / MIN_TOKEN_SIZE);
  
  // Map to size range (exponential scaling)
  return MIN_NODE_SIZE + (MAX_NODE_SIZE - MIN_NODE_SIZE) * logScale;
}

// Utility function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(1) + ' GB';
}

export const FileGraph = forwardRef<FileGraphRef, FileGraphProps>(function FileGraph(
  { root, onViewFile, projectRoot, onRequestAIFileChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { width, height } = useResizeObserver(containerRef as React.RefObject<HTMLElement>);
  
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simulation, setSimulation] = useState<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  
  // Get selected files from the global state, but store internal state in a ref to prevent re-renders
  const { selectedFiles: reactSelectedFiles, selectFiles, toggleFile } = useSelectedFiles();
  
  // Store selected files in a ref to prevent re-renders when selection changes
  const selectedFilesRef = useRef<string[]>([...reactSelectedFiles]);
  
  // Sync selected files from React state only on mount
  useEffect(() => {
    selectedFilesRef.current = [...reactSelectedFiles];
    // Only run once on mount to get initial state
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Function to toggle file selection without updating React state immediately
  const toggleFileInternal = useCallback((filePath: string) => {
    const isSelected = selectedFilesRef.current.includes(filePath);
    
    if (isSelected) {
      // Remove file from selections
      selectedFilesRef.current = selectedFilesRef.current.filter(path => path !== filePath);
    } else {
      // Add file to selections
      selectedFilesRef.current = [...selectedFilesRef.current, filePath];
    }
    
    // Update React state, but this should not trigger a re-render of D3 graph
    // because we're using the ref for D3 rendering decisions
    toggleFile(filePath);
    
    return !isSelected; // Return new selection state
  }, [toggleFile]);
  
  // Function to bulk select/deselect files without causing re-renders
  const updateFilesSelectionInternal = useCallback((filePaths: string[], selected: boolean) => {
    if (selected) {
      // Add files to selections if not already selected
      const newPaths = filePaths.filter(path => !selectedFilesRef.current.includes(path));
      selectedFilesRef.current = [...selectedFilesRef.current, ...newPaths];
    } else {
      // Remove files from selections
      selectedFilesRef.current = selectedFilesRef.current.filter(path => !filePaths.includes(path));
    }
    
    // Update React state without triggering a D3 re-render
    selectFiles(selectedFilesRef.current);
  }, [selectFiles]);
  
  // Function to estimate token count for a file
  const estimateFileTokenCount = (file?: ProjectFile): number => {
    if (!file) return 0;
    
    // If the file has a tokenCount property, use it
    if (file.meta) {
      try {
        const meta = JSON.parse(file.meta);
        if (meta.tokenCount !== undefined) {
          return meta.tokenCount;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Otherwise estimate based on content length
    if (file.content) {
      // Very rough estimate - approx 4 chars per token for English text
      return Math.ceil(file.content.length / 4);
    }
    
    // Rough estimate based on file size
    return Math.ceil(file.size / 4);
  };
  
  // Build the graph data with node and edge information
  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];
    
    function processNode(
      nodeObj: Record<string, FileNode>,
      parentPath: string | undefined = undefined,
      depth: number = 0
    ) {
      Object.entries(nodeObj).forEach(([name, node]) => {
        const nodePath = parentPath ? `${parentPath}/${name}` : name;
        const parentNode = parentPath ? graphNodes.find(n => n.path === parentPath) : undefined;
        
        if (node._folder) {
          // This is a folder node
          graphNodes.push({
            id: nodePath,
            name,
            path: nodePath,
            radius: 30 - depth * 2, // Folders a bit larger, decreasing by depth
            type: "folder",
            tokenCount: 0, // Folders don't have token counts
            parent: parentPath,
            isSelected: false, // Folders themselves aren't selected
            node
          });
          
          // Connect to parent if it exists
          if (parentNode) {
            graphEdges.push({
              source: parentPath as string, // Type assertion since we know it exists
              target: nodePath,
              strength: 1.0
            });
          }
        }
        
        // Process children if this is a folder
        if (node._folder && node.children) {
          processNode(
            node.children,
            nodePath,
            depth + 1
          );
        }
      });
    }
    
    processNode(root);
    return { nodes: graphNodes, edges: graphEdges };
  }, [root]);
  
  // D3 rendering effect - runs when dimensions change or data changes
  useEffect(() => {
    if (!containerRef.current || !width || !height || !nodes.length) return;
    
    // Clear previous SVG
    d3.select(containerRef.current).select("svg").remove();
    
    // Create SVG
    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height].join(" "))
      .attr("style", "max-width: 100%; height: auto;");
    
    svgRef.current = svg.node() as SVGSVGElement;
    
    // Create main group that will be transformed
    const g = svg.append("g");
    
    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement>) => {
        g.attr("transform", event.transform.toString());
      });
    
    // Apply zoom to SVG
    svg.call(zoom as any);
    
    // Set initial zoom level
    const initialScale = 0.8;
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initialScale);
    
    svg.call((zoom as any).transform, initialTransform);
    
    // Create link and node groups
    const linksGroup = g.append("g").attr("class", "links");
    const nodesGroup = g.append("g").attr("class", "nodes");
    
    // Create links (edges)
    const link = linksGroup.selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", d => {
        const sourceNode = typeof d.source === 'string' 
          ? nodes.find(n => n.id === d.source) 
          : d.source as GraphNode;
        
        return sourceNode?.isSelected ? colors.edgeSelected : colors.edgeBase;
      })
      .attr("stroke-width", d => 1 + d.strength * 2)
      .attr("stroke-opacity", d => 0.2 + d.strength * 0.8);
    
    // Add link glow effect for selected paths
    linksGroup.selectAll("line")
      .filter((d: any) => {
        const sourceNode = typeof d.source === 'string' 
          ? nodes.find(n => n.id === d.source) 
          : d.source as GraphNode;
        return !!sourceNode?.isSelected;
      })
      .attr("filter", "url(#glow)");
    
    // Create SVG defs for filters and markers
    const defs = svg.append("defs");
    
    // Glow filter for selected elements
    const glowFilter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "blur");
    
    glowFilter.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "blur")
      .attr("operator", "over");
    
    // Custom SVG shapes for folders
    defs.append("path")
      .attr("id", "folder-icon")
      .attr("d", "M2,3 L10,3 L12,5 L22,5 L22,21 L2,21 Z")
      .attr("transform", "scale(0.5)");
    
    // Custom SVG shape for files (document icon)
    defs.append("path")
      .attr("id", "file-icon")
      .attr("d", "M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z")
      .attr("transform", "scale(0.5)");
    
    // Create nodes
    const nodeGroup = nodesGroup.selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("id", d => `node-${d.id.replace(/\//g, "-")}`)
      .classed("selected", d => {
        // Mark files as selected based on the ref, not React state
        return d.type === "file" && selectedFilesRef.current.includes(d.path);
      });
    
    // Add file node shapes (use hexagon for files)
    nodeGroup.filter(d => d.type === "file")
      .append("polygon")
      .attr("points", d => {
        const r = tokenCountToNodeSize(d.node.file ? estimateFileTokenCount(d.node.file) : 0);
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = i * 2 * Math.PI / 6;
          const x = r * Math.cos(angle);
          const y = r * Math.sin(angle);
          points.push(`${x},${y}`);
        }
        return points.join(" ");
      })
      .attr("fill", d => {
        // Use the ref to determine selection state
        return selectedFilesRef.current.includes(d.path) ? colors.fileSelected : colors.fileBase;
      })
      .attr("stroke", colors.glow)
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.8);
    
    // Add folder node shapes (rectangles for folders)
    nodeGroup.filter(d => d.type === "folder")
      .append("rect")
      .attr("x", d => -d.radius / 1.5)
      .attr("y", d => -d.radius / 1.5)
      .attr("width", d => d.radius * 1.3)
      .attr("height", d => d.radius * 1.3)
      .attr("rx", 4) // Rounded corners
      .attr("ry", 4)
      .attr("fill", colors.folderBase)
      .attr("stroke", colors.glow)
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.8);
    
    // Helper to get file extension
    const getFileExt = (name: string): string => {
      if (!name) return "";
      const parts = name.split('.');
      return parts.length > 1 ? parts.pop()?.toUpperCase() || "" : "";
    };
    
    // Add file extension label for files
    nodeGroup.filter(d => d.type === "file")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("font-size", d => Math.min(d.radius * 0.7, 10))
      .attr("fill", colors.text)
      .text(d => getFileExt(d.name) || "");
    
    // Add label for all nodes
    nodeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", d => d.type === "folder" ? d.radius * 0.7 + 15 : d.radius + 15)
      .attr("font-size", "10px")
      .attr("fill", colors.text)
      .text(d => d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name);
    
    // Add glow effect for selected nodes
    nodeGroup.filter(d => selectedFilesRef.current.includes(d.path))
      .attr("filter", "url(#glow)");
    
    // Create D3 force simulation
    const forceSimulation = d3.forceSimulation<GraphNode>(nodes)
      .force("charge", d3.forceManyBody().strength(-150))
      .force("link", d3.forceLink<GraphNode, GraphEdge>(edges as any)
        .id(d => d.id)
        .distance(d => {
          // Base distance on combined radius of source and target
          const source = typeof d.source === 'string' 
            ? nodes.find(n => n.id === d.source) 
            : d.source as GraphNode;
          
          const target = typeof d.target === 'string' 
            ? nodes.find(n => n.id === d.target) 
            : d.target as GraphNode;
          
          return ((source?.radius || 0) + (target?.radius || 0)) * 2.5;
        })
        .strength(0.7))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collision", d3.forceCollide().radius((d: any) => (d as GraphNode).radius * 1.5).strength(0.8))
      .on("tick", ticked);
    
    setSimulation(forceSimulation as any);
    
    // Set up drag behavior
    const drag = d3.drag<any, GraphNode>()
      .on("start", (event: D3DragEvent<any, GraphNode>, d: GraphNode) => {
        if (!event.active) forceSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: D3DragEvent<any, GraphNode>, d: GraphNode) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: D3DragEvent<any, GraphNode>, d: GraphNode) => {
        if (!event.active) forceSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    
    // Apply drag to nodes
    nodeGroup.call(drag as any);
    
    function ticked() {
      link
        .attr("x1", d => {
          const source = typeof d.source === 'string' 
            ? nodes.find(n => n.id === d.source) 
            : d.source as GraphNode;
          return source?.x || 0;
        })
        .attr("y1", d => {
          const source = typeof d.source === 'string' 
            ? nodes.find(n => n.id === d.source) 
            : d.source as GraphNode;
          return source?.y || 0;
        })
        .attr("x2", d => {
          const target = typeof d.target === 'string' 
            ? nodes.find(n => n.id === d.target) 
            : d.target as GraphNode;
          return target?.x || 0;
        })
        .attr("y2", d => {
          const target = typeof d.target === 'string' 
            ? nodes.find(n => n.id === d.target) 
            : d.target as GraphNode;
          return target?.y || 0;
        });
      
      nodeGroup.attr("transform", d => {
        const x = d?.x ?? 0;
        const y = d?.y ?? 0;
        return `translate(${x},${y})`;
      });
    }
    
    // Handle node hover events
    nodeGroup
      .on("mouseenter", (event: any, d: any) => {
        setHoveredNode(d);
        setPopoverPosition({ 
          x: event.pageX, 
          y: event.pageY 
        });
        setPopoverOpen(true);
        
        // Highlight on hover
        d3.select(event.currentTarget)
          .select(d.type === "folder" ? "rect" : "polygon")
          .transition()
          .duration(200)
          .attr("fill", d.type === "folder" ? colors.folderHover : colors.fileHover);
      })
      .on("mouseleave", (event: any) => {
        setPopoverOpen(false);
        
        // Remove highlight
        const currentNode = d3.select(event.currentTarget);
        const nodeData = currentNode.datum() as GraphNode;
        
        currentNode
          .select(nodeData.type === "folder" ? "rect" : "polygon")
          .transition()
          .duration(200)
          .attr("fill", 
            nodeData.type === "file" && selectedFilesRef.current.includes(nodeData.path)
              ? colors.fileSelected 
              : (nodeData.type === "folder" ? colors.folderBase : colors.fileBase)
          );
      })
      .on("click", (event: any, d: any) => {
        // Handle selection
        if (d.type === 'file') {
          // Update visual selection without recreating the graph
          const circle = d3.select(event.currentTarget).select('polygon');
          const newSelectionState = toggleFileInternal(d.path);
          
          // Update visual appearance directly instead of re-rendering the graph
          circle.attr("fill", newSelectionState
            ? colors.fileSelected
            : colors.fileBase);
            
          // Add or remove glow effect
          d3.select(event.currentTarget)
            .attr("filter", newSelectionState ? "url(#glow)" : null);
        } else if (d.type === 'folder' && d.node._folder) {
          // Handle folder selection
          const filePaths: string[] = [];
          
          // Collect all file paths in this folder
          const collectFilePaths = (node: FileNode, basePath: string) => {
            if (node.file) {
              filePaths.push(basePath);
            } else if (node._folder && node.children) {
              Object.entries(node.children).forEach(([name, childNode]) => {
                collectFilePaths(childNode as FileNode, `${basePath}/${name}`);
              });
            }
          };
          
          Object.entries(d.node.children || {}).forEach(([name, childNode]) => {
            collectFilePaths(childNode as FileNode, `${d.path}/${name}`);
          });
          
          // Check if all files are already selected using our internal ref
          const allSelected = filePaths.every(path => selectedFilesRef.current.includes(path));
          
          // Update visual appearance of the folder node
          const folderShape = d3.select(event.currentTarget).select('rect');
          folderShape.attr("fill", !allSelected 
            ? colors.folderSelected 
            : colors.folderBase);
          
          // Update the internal selection state directly
          updateFilesSelectionInternal(filePaths, !allSelected);
          
          // Update visual appearance of all child file nodes
          filePaths.forEach(filePath => {
            // Find all file nodes in the document
            d3.selectAll('g.node').each(function(nodeData: any) {
              if (nodeData.path === filePath) {
                const fileShape = d3.select(this).select('polygon');
                fileShape.attr("fill", !allSelected 
                  ? colors.fileSelected 
                  : colors.fileBase);
                
                // Add or remove glow effect
                d3.select(this)
                  .attr("filter", !allSelected ? "url(#glow)" : null);
              }
            });
          });
        }
      });

    // This is called by the parent component to center the graph
    const focusGraph = () => {
      if (!svg || !width || !height) return;
      
      // Reset zoom to fit all nodes
      const zoomTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.8);
      
      svg.transition()
        .duration(750)
        .call((zoom as any).transform, zoomTransform);
    };
    
    // Expose the focusGraph function via ref
    if (ref) {
      if (typeof ref === 'function') {
        ref({ focusGraph });
      } else {
        ref.current = { focusGraph };
      }
    }
  }, [width, height, nodes, edges, estimateFileTokenCount, selectedFilesRef, toggleFileInternal, updateFilesSelectionInternal]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error('Error attempting to exit fullscreen:', err);
        });
      }
    }
  };
  
  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
      
      {/* Hover Popover */}
      {popoverOpen && hoveredNode && (
        <div 
          className="absolute z-20 bg-black/80 text-white p-3 rounded-lg shadow-lg backdrop-blur-sm"
          style={{
            left: popoverPosition.x + 10,
            top: popoverPosition.y + 10,
            maxWidth: '300px'
          }}
        >
          <div className="font-semibold mb-1">{hoveredNode.name}</div>
          <div className="text-xs opacity-80">{hoveredNode.path}</div>
          {hoveredNode.type === 'file' && hoveredNode.node.file && (
            <>
              <div className="mt-2 text-xs">
                <span className="opacity-70">Size: </span>
                {formatFileSize(hoveredNode.node.file.size)}
              </div>
              {hoveredNode.node.file.summary && (
                <div className="mt-1 text-xs">
                  <span className="opacity-70">Summary: </span>
                  {hoveredNode.node.file.summary.substring(0, 100)}
                  {hoveredNode.node.file.summary.length > 100 ? '...' : ''}
                </div>
              )}
              {onRequestAIFileChange && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2 text-xs"
                  onClick={() => onRequestAIFileChange?.(hoveredNode.path)}
                >
                  Request AI Changes
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}); 